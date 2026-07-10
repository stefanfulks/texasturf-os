/**
 * POST /api/turfcasa/orders
 *
 * Order intake from the turfcasa.com storefront. Called by the store's Stripe
 * webhook once payment is captured. This is the system-of-record write:
 *
 *   1. verify HMAC (TURFCASA_ORDER_INTAKE_SECRET over `${timestamp}.${body}`)
 *   2. idempotency guard on stripe_session_id (Stripe retries are safe)
 *   3. insert turfcasa_orders + turfcasa_order_lines (money in cents, as charged)
 *   4. issue the auto-invoice (turfcasa_invoices, status 'paid')
 *   5. open a warehouse pull order (warehouse_pull_lists) linked to the order
 *   6. post "ready to pull" to the TurfCasa warehouse Slack channel
 *
 * Public endpoint: the HMAC is what keeps non-store callers from forging orders
 * (allowlisted in src/lib/supabase/middleware.ts so the session redirect skips it).
 *
 * Physical roll allocation is intentionally NOT mutated here — the pull order is
 * the crew's signal to pull/allocate through the existing warehouse flow, which
 * avoids double-allocation with the OS allocation UI.
 *
 * Node runtime: raw body + crypto for signature verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { postMessage } from "@/lib/integrations/slack";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";
const TURFCASA_WAREHOUSE_CHANNEL =
  process.env.SLACK_TURFCASA_WAREHOUSE_CHANNEL_ID ??
  process.env.SLACK_WAREHOUSE_CHANNEL_ID ??
  "#turfcasa-warehouse";

// Reject signatures older than this to blunt replay (Stripe also dedupes).
const MAX_SKEW_SECONDS = 60 * 10;

const lineSchema = z.object({
  web_slug: z.string().default(""),
  name: z.string().default("item"),
  unit: z.string().default("each"),
  quantity: z.number().positive(),
  unit_price_cents: z.number().int().nonnegative(),
  line_total_cents: z.number().int().nonnegative(),
});

const schema = z.object({
  stripe_session_id: z.string().min(1),
  placed_at: z.string().optional(),
  currency: z.string().default("usd"),
  customer: z.object({
    name: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
  }),
  fulfillment: z.object({
    method: z.enum(["pickup", "delivery", "freight"]).default("pickup"),
    zip: z.string().default(""),
  }),
  pricing_role: z.string().default("retail"),
  subtotal_cents: z.number().int().nonnegative().default(0),
  tax_cents: z.number().int().nonnegative().default(0),
  shipping_cents: z.number().int().nonnegative().default(0),
  total_cents: z.number().int().nonnegative().default(0),
  lines: z.array(lineSchema).min(1),
});

function verifySignature(raw: string, header: string, timestamp: string, secret: string): boolean {
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.TURFCASA_ORDER_INTAKE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const raw = await req.text();
  const signature = req.headers.get("x-turfcasa-signature") ?? "";
  const timestamp = req.headers.get("x-turfcasa-timestamp") ?? "";
  if (!signature || !timestamp || !verifySignature(raw, signature, timestamp, secret)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }
  const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) {
    return NextResponse.json({ error: "stale" }, { status: 401 });
  }

  const parsed = schema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const order = parsed.data;
  const db = supabaseAdmin();

  // ── idempotency ────────────────────────────────────────────────────────────
  const { data: existing } = await db
    .from("turfcasa_orders")
    .select("id, order_number")
    .eq("stripe_session_id", order.stripe_session_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      order_id: existing.id,
      order_number: existing.order_number,
    });
  }

  const placedAt = order.placed_at ?? new Date().toISOString();

  // ── order header ───────────────────────────────────────────────────────────
  const { data: created, error: orderErr } = await db
    .from("turfcasa_orders")
    .insert({
      stripe_session_id: order.stripe_session_id,
      status: "paid",
      customer_name: order.customer.name || null,
      customer_email: order.customer.email || null,
      customer_phone: order.customer.phone || null,
      fulfillment_method: order.fulfillment.method,
      fulfillment_zip: order.fulfillment.zip || null,
      pricing_role: order.pricing_role,
      currency: order.currency,
      subtotal_cents: order.subtotal_cents,
      tax_cents: order.tax_cents,
      shipping_cents: order.shipping_cents,
      total_cents: order.total_cents,
      placed_at: placedAt,
    })
    .select("id, order_number")
    .single();
  if (orderErr || !created) {
    return NextResponse.json({ error: "order_insert_failed" }, { status: 500 });
  }
  const orderId: string = created.id;
  const orderNumber: number = created.order_number;

  // ── map lines to OS products (by web_slug → availability.product_name) ──────
  const slugs = order.lines.map((l) => l.web_slug).filter(Boolean);
  const productBySlug = new Map<string, { product_name: string | null; product_id: string | null }>();
  if (slugs.length > 0) {
    const { data: avail } = await db
      .from("turfcasa_web_availability")
      .select("web_slug, product_name")
      .in("web_slug", slugs);
    const names = (avail ?? []).map((a: { product_name: string | null }) => a.product_name).filter(Boolean);
    const idByName = new Map<string, string>();
    if (names.length > 0) {
      const { data: prods } = await db
        .from("turfcasa_products")
        .select("id, name")
        .in("name", names);
      for (const p of prods ?? []) idByName.set(String(p.name).toLowerCase(), p.id);
    }
    for (const a of avail ?? []) {
      const pname: string | null = a.product_name;
      productBySlug.set(a.web_slug, {
        product_name: pname,
        product_id: pname ? idByName.get(pname.toLowerCase()) ?? null : null,
      });
    }
  }

  const lineRows = order.lines.map((l) => {
    const match = productBySlug.get(l.web_slug);
    return {
      order_id: orderId,
      web_slug: l.web_slug || null,
      product_name: match?.product_name ?? null,
      name: l.name,
      unit: l.unit,
      quantity: l.quantity,
      unit_price_cents: l.unit_price_cents,
      line_total_cents: l.line_total_cents,
      turfcasa_product_id: match?.product_id ?? null,
    };
  });
  await db.from("turfcasa_order_lines").insert(lineRows);

  // ── auto-invoice (paid receipt) ────────────────────────────────────────────
  const { data: invoice } = await db
    .from("turfcasa_invoices")
    .insert({
      order_id: orderId,
      status: "paid",
      subtotal_cents: order.subtotal_cents,
      tax_cents: order.tax_cents,
      total_cents: order.total_cents,
      source: "web_order",
      issued_at: placedAt,
      paid_at: placedAt,
    })
    .select("id, invoice_number")
    .single();
  if (invoice) {
    await db.from("turfcasa_orders").update({ invoice_id: invoice.id }).eq("id", orderId);
  }

  // ── warehouse pull order ───────────────────────────────────────────────────
  const totalSqft = order.lines
    .filter((l) => l.unit === "sqft")
    .reduce((sum, l) => sum + l.quantity, 0);
  const firstTurf = order.lines.find((l) => l.unit === "sqft");
  const itemCount = order.lines.length;
  const address =
    order.fulfillment.method === "pickup"
      ? "Warehouse pickup"
      : [order.fulfillment.method, order.fulfillment.zip].filter(Boolean).join(" · ");
  const { data: pull } = await db
    .from("warehouse_pull_lists")
    .insert({
      job_date: placedAt.slice(0, 10),
      client_name: order.customer.name || `Web order #${orderNumber}`,
      address,
      turf_product: firstTurf?.name ?? null,
      turf_total_sqft: totalSqft > 0 ? totalSqft : null,
      status: "draft",
      notes: `TurfCasa web order #${orderNumber} — ${itemCount} line item(s), ${(order.total_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}. ${APP_URL}/turfcasa/orders`,
    })
    .select("id")
    .single();
  if (pull) {
    await db.from("turfcasa_orders").update({ pull_list_id: pull.id }).eq("id", orderId);
  }

  // ── notify the TurfCasa warehouse Slack channel ────────────────────────────
  const totalLabel = (order.total_cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  const slackText =
    `🟢 *New TurfCasa web order #${orderNumber}* — ready to pull\n` +
    `${order.customer.name || "Online customer"} · ${itemCount} item(s) · ${totalLabel} · ${order.fulfillment.method}\n` +
    `${APP_URL}/turfcasa/orders`;
  // Non-fatal: a Slack outage must not fail the order write.
  const slackRes = await postMessage(TURFCASA_WAREHOUSE_CHANNEL, slackText);
  if (!slackRes.ok) {
    console.error("[turfcasa/orders] slack post failed:", slackRes.code, slackRes.detail);
  }

  return NextResponse.json({ ok: true, order_id: orderId, order_number: orderNumber });
}
