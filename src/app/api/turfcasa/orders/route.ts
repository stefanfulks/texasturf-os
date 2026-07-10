import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Website order intake. The TurfCasa site POSTs completed checkouts here;
 * they land as status "new" for the warehouse to confirm and fulfill.
 *
 * Auth: shared-secret bearer (TURFCASA_ORDER_SECRET) — same pattern as the
 * cron routes. Service-role write is appropriate here (external trusted
 * caller, no user session), matching the Jobber-webhook precedent.
 */

function constantTimeBearerEqual(authHeader: string | null, secret: string) {
  if (!authHeader) return false;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const payloadSchema = z.object({
  customer_name:  z.string().min(1),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().optional(),
  company:        z.string().optional(),
  is_trade:       z.boolean().optional(),
  fulfillment:    z.enum(["will_call", "delivery"]).default("will_call"),
  delivery_address: z.string().optional(),
  requested_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:          z.string().optional(),
  subtotal:       z.number().nonnegative().optional(),
  total:          z.number().nonnegative().optional(),
  lines: z
    .array(
      z.object({
        name:       z.string().min(1),
        qty:        z.number().positive(),
        unit:       z.string().default("each"),
        unit_price: z.number().nonnegative().optional(),
        sku:        z.string().optional(), // matched to catalog by name later
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const secret = process.env.TURFCASA_ORDER_SECRET;
  if (!secret || !constantTimeBearerEqual(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }

  const d = parsed.data;
  const db = supabaseAdmin();
  try {
    const { data: order, error } = await db
      .from("turfcasa_orders")
      .insert({
        source:           "website",
        status:           "new",
        fulfillment:      d.fulfillment,
        customer_name:    d.customer_name,
        customer_email:   d.customer_email ?? null,
        customer_phone:   d.customer_phone ?? null,
        company:          d.company ?? null,
        is_trade:         d.is_trade ?? false,
        delivery_address: d.delivery_address ?? null,
        requested_date:   d.requested_date ?? null,
        notes:            d.notes ?? null,
        subtotal:         d.subtotal ?? null,
        total:            d.total ?? null,
      })
      .select("id, order_number")
      .single();
    if (error || !order) throw new Error(error?.message ?? "insert failed");

    const { error: linesError } = await db.from("turfcasa_order_lines").insert(
      d.lines.map((l, i) => ({
        order_id:   order.id,
        name:       l.name,
        qty:        l.qty,
        unit:       l.unit,
        unit_price: l.unit_price ?? null,
        sort_order: i,
      })),
    );
    if (linesError) throw new Error(linesError.message);

    await db.from("turfcasa_order_events").insert({
      order_id:  order.id,
      event:     "created",
      to_status: "new",
      // actor null = the website
    });

    return NextResponse.json(
      { ok: true, order_id: order.id, order_number: order.order_number },
      { status: 201 },
    );
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
