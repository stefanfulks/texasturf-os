import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { buildDigestBlocks, postBlocks, dmUserByEmail, type DigestLine } from "@/lib/integrations/slack-purchasing";
import type { PurchaseOrder, PoStatus, PoPaymentStatus } from "@/lib/db-helpers.types";

// Vercel Cron — daily morning digest to #vendor-order-status.
// vercel.json: { "path": "/api/cron/vendor-digest", "schedule": "0 12 * * *" }  (07:00 CT during CDT)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function constantTimeBearerEqual(authHeader: string | null, secret: string) {
  if (!authHeader) return false;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const NEEDS_ORDERING: PoStatus[] = ["new_request", "awaiting_review", "awaiting_approval", "quote_gathering", "ready_to_order"];
const WAITING: PoStatus[] = ["order_placed", "waiting_on_vendor"];
const SHIPPING: PoStatus[] = ["order_placed", "waiting_on_vendor", "in_transit"];
const CLOSED: PoStatus[] = ["closed", "cancelled"];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const due = new Date(d.slice(0, 10) + "T00:00:00").getTime();
  const now = new Date(todayISO() + "T00:00:00").getTime();
  return Math.round((due - now) / 86_400_000);
}
function money(n: number | null): string {
  return n == null ? "$0" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function derivePaymentStatus(remaining: number | null, due: string | null, current: PoPaymentStatus): PoPaymentStatus {
  if (remaining != null && remaining <= 0) return "paid";
  const days = daysUntil(due);
  if (days == null) return current === "paid" ? "not_due" : current;
  if (days < 0) return "past_due";
  if (days <= 7) return "due_soon";
  return "not_due";
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !constantTimeBearerEqual(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const channel = process.env.SLACK_VENDOR_ORDER_CHANNEL_ID;

  const [{ data: ordersData }, { data: profilesData }, { data: vendorsData }] = await Promise.all([
    supabase.from("purchase_orders").select("*").not("status", "in", `(${CLOSED.join(",")})`),
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("vendors").select("id, name"),
  ]);
  const orders = (ordersData ?? []) as PurchaseOrder[];
  const buyerName = new Map((profilesData ?? []).map((p) => [p.id, p.full_name || p.email]));
  const buyerEmail = new Map((profilesData ?? []).map((p) => [p.id, p.email]));
  const vendorName = new Map((vendorsData ?? []).map((v) => [v.id, v.name]));

  const label = (o: PurchaseOrder) => (o.material_needed || o.request_description || "(no description)").slice(0, 80);
  const vName = (o: PurchaseOrder) => (o.vendor_id ? vendorName.get(o.vendor_id) ?? "vendor TBD" : "vendor TBD");

  const overdue: DigestLine[] = [];
  const needsOrdering: DigestLine[] = [];
  const waitingOnVendor: DigestLine[] = [];
  const inTransit: DigestLine[] = [];
  const upcomingPayments: DigestLine[] = [];

  // Per-buyer nudges, consolidated into one DM each.
  const nudges = new Map<string, string[]>(); // email → messages
  const addNudge = (buyerId: string | null, msg: string) => {
    if (!buyerId) return;
    const email = buyerEmail.get(buyerId);
    if (!email) return;
    if (!nudges.has(email)) nudges.set(email, []);
    nudges.get(email)!.push(msg);
  };

  let paymentStatusUpdates = 0;

  for (const o of orders) {
    const buyer = o.assigned_buyer_id ? buyerName.get(o.assigned_buyer_id) ?? "Unassigned" : "Unassigned";

    // Keep payment_status fresh.
    const derived = derivePaymentStatus(o.remaining_balance, o.payment_due_date, o.payment_status);
    if (derived !== o.payment_status) {
      await supabase.from("purchase_orders").update({ payment_status: derived }).eq("id", o.id);
      paymentStatusUpdates++;
    }

    const etaDays = daysUntil(o.eta);
    const dueDays = daysUntil(o.payment_due_date);
    const reqAgeDays = o.request_date ? -1 * (daysUntil(o.request_date) ?? 0) : 0;

    if (NEEDS_ORDERING.includes(o.status)) {
      needsOrdering.push({ id: o.id, text: `*${label(o)}* — ${buyer}${o.needed_by ? `, need by ${fmtDate(o.needed_by)}` : ""}` });
    }
    if (WAITING.includes(o.status)) {
      waitingOnVendor.push({ id: o.id, text: `*${label(o)}* — ${vName(o)}${o.eta ? `, ETA ${fmtDate(o.eta)}` : ", _no ETA_"}` });
    }
    if (o.status === "in_transit") {
      inTransit.push({ id: o.id, text: `*${label(o)}* — ${vName(o)}, ETA ${fmtDate(o.eta)}${o.tracking_number ? `, \`${o.tracking_number}\`` : ", _no tracking#_"}` });
    }
    if (o.remaining_balance != null && o.remaining_balance > 0 && dueDays != null && dueDays >= 0 && dueDays <= 7) {
      upcomingPayments.push({ id: o.id, text: `${vName(o)} — *${money(o.remaining_balance)}* due ${fmtDate(o.payment_due_date)}` });
      addNudge(o.assigned_buyer_id, `💵 Payment to ${vName(o)} (${money(o.remaining_balance)}) is due ${fmtDate(o.payment_due_date)} — ${label(o)}`);
    }

    // Overdue (highly visible)
    if (NEEDS_ORDERING.includes(o.status) && o.needed_by && (daysUntil(o.needed_by) ?? 0) < 0) {
      overdue.push({ id: o.id, text: `*${label(o)}* still not ordered — was needed ${fmtDate(o.needed_by)} (${buyer})` });
    }
    if (SHIPPING.includes(o.status) && etaDays != null && etaDays < 0) {
      overdue.push({ id: o.id, text: `*${label(o)}* from ${vName(o)} past ETA ${fmtDate(o.eta)}` });
      addNudge(o.assigned_buyer_id, `🚚 ${label(o)} from ${vName(o)} is past its ETA (${fmtDate(o.eta)}). Check on it?`);
    }
    if (o.remaining_balance != null && o.remaining_balance > 0 && dueDays != null && dueDays < 0) {
      overdue.push({ id: o.id, text: `Payment ${money(o.remaining_balance)} to ${vName(o)} is *past due* (${fmtDate(o.payment_due_date)})` });
      addNudge(o.assigned_buyer_id, `⚠️ Payment ${money(o.remaining_balance)} to ${vName(o)} is PAST DUE (${fmtDate(o.payment_due_date)}).`);
    }
    // Waiting too long (>5 days unmoved in early stages)
    if (["new_request", "awaiting_review", "quote_gathering"].includes(o.status) && reqAgeDays > 5) {
      addNudge(o.assigned_buyer_id, `⏳ "${label(o)}" has been sitting in ${o.status.replace(/_/g, " ")} for ${reqAgeDays} days.`);
    }
  }

  // Post digest
  let digestPosted = false;
  if (channel) {
    const { text, blocks } = buildDigestBlocks({ overdue, needsOrdering, waitingOnVendor, inTransit, upcomingPayments });
    const res = await postBlocks(channel, text, blocks);
    digestPosted = res.ok;
    if (!res.ok) {
      Sentry.captureMessage(`vendor-digest post failed: ${res.error}`, { level: "warning", tags: { cron: "vendor-digest" } });
    }
  }

  // Send consolidated buyer DMs
  let dmsSent = 0;
  for (const [email, msgs] of nudges) {
    const ok = await dmUserByEmail(email, `*Vendor order reminders:*\n${msgs.map((m) => `• ${m}`).join("\n")}`);
    if (ok) dmsSent++;
  }

  return NextResponse.json({
    ok: true,
    openOrders: orders.length,
    digestPosted,
    paymentStatusUpdates,
    dmsSent,
    counts: {
      overdue: overdue.length,
      needsOrdering: needsOrdering.length,
      waitingOnVendor: waitingOnVendor.length,
      inTransit: inTransit.length,
      upcomingPayments: upcomingPayments.length,
    },
  });
}
