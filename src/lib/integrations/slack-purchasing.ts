// Slack helpers for the Vendor Purchasing module: the daily digest to
// #vendor-order-status, per-order quick actions, buyer DMs, and the modals
// behind the /order command and the "Create Vendor Order" message shortcut.
// Reuses the shared bot helpers (openDM / lookupUserByEmail) from ./slack.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { PoStatus, PurchaseOrderUpdate } from "@/lib/db-helpers.types";
import { openDM, lookupUserByEmail } from "./slack";
import { STAGE_ORDER } from "@/app/(app)/operations/vendor-orders/_lib/status";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";

export type SlackBlock = Record<string, unknown>;
type Service = SupabaseClient<Database>;

// ── Low-level posting ─────────────────────────────────────────────────────────
async function slackPost(endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!SLACK_BOT_TOKEN) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`https://slack.com/api/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function postBlocks(channel: string, text: string, blocks: SlackBlock[]) {
  const r = await slackPost("chat.postMessage", { channel, text, blocks, unfurl_links: false });
  return { ok: !!r.ok, ts: r.ts as string | undefined, error: r.error as string | undefined };
}

export async function openModal(triggerId: string, view: SlackBlock) {
  return slackPost("views.open", { trigger_id: triggerId, view });
}

/** Reply to an interaction's response_url (ephemeral by default). */
export async function respondViaUrl(responseUrl: string, text: string, ephemeral = true): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_type: ephemeral ? "ephemeral" : "in_channel", text }),
    });
  } catch {
    /* best-effort */
  }
}

export async function dmUserByEmail(email: string, text: string): Promise<boolean> {
  const lookup = await lookupUserByEmail(email);
  if (!lookup.ok) return false;
  const dm = await openDM(lookup.user.id);
  if (!dm.ok) return false;
  const r = await slackPost("chat.postMessage", { channel: dm.channel.id, text });
  return !!r.ok;
}

export function orderUrl(id: string): string {
  return `${APP_URL}/operations/vendor-orders/${id}`;
}

// ── Quick actions (button/overflow → DB mutation) ─────────────────────────────
export type PoAction =
  | "mark_ordered" | "update_eta" | "mark_delivered"
  | "deposit_paid" | "invoice_received" | "final_payment";

export const ACTION_LABEL: Record<PoAction, string> = {
  mark_ordered:     "📦 Mark Ordered",
  update_eta:       "📅 Update ETA",
  mark_delivered:   "✅ Mark Delivered",
  deposit_paid:     "💵 Deposit Paid",
  invoice_received: "🧾 Invoice Received",
  final_payment:    "✔️ Final Payment Made",
};

function rank(s: PoStatus): number { return STAGE_ORDER.indexOf(s); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

/**
 * Apply a one-tap status update from Slack. Runs under the service client
 * (the Slack request has no app session). Returns a human confirmation string,
 * or null if the order is gone.
 */
export async function applyQuickAction(
  service: Service,
  orderId: string,
  action: PoAction,
  byNote: string,
  eta?: string,
): Promise<string | null> {
  const { data: cur } = await service.from("purchase_orders").select("status, order_date").eq("id", orderId).maybeSingle();
  if (!cur) return null;
  const curStatus = cur.status as PoStatus;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let newStatus: PoStatus | null = null;
  let confirm = "";

  const advance = (s: PoStatus) => { if (rank(s) > rank(curStatus)) newStatus = s; };

  switch (action) {
    case "mark_ordered":
      advance("order_placed");
      if (!cur.order_date) updates.order_date = todayISO();
      confirm = "Marked as *Order Placed*.";
      break;
    case "update_eta":
      if (eta) { updates.eta = eta.slice(0, 10); confirm = `ETA set to ${eta.slice(0, 10)}.`; }
      else return "No ETA provided.";
      break;
    case "mark_delivered":
      updates.actual_delivery_date = todayISO();
      advance("delivered");
      confirm = "Marked as *Delivered*.";
      break;
    case "deposit_paid":
      updates.deposit_paid_date = todayISO();
      updates.deposit_required = true;
      confirm = "Deposit marked paid.";
      break;
    case "invoice_received":
      updates.invoice_date = todayISO();
      confirm = "Invoice date recorded.";
      break;
    case "final_payment":
      updates.remaining_balance = 0;
      updates.payment_status = "paid";
      advance("closed");
      confirm = "Final payment recorded — order *Closed*.";
      break;
  }

  if (newStatus && newStatus !== curStatus) {
    updates.status = newStatus;
    updates.status_changed_at = new Date().toISOString();
  }

  await service.from("purchase_orders").update(updates as unknown as PurchaseOrderUpdate).eq("id", orderId);
  await service.from("purchase_order_events").insert({
    purchase_order_id: orderId,
    event_type: newStatus ? "status_change" : "field_update",
    source: "slack",
    previous_status: newStatus ? curStatus : null,
    new_status: newStatus,
    notes: `${ACTION_LABEL[action]} via Slack — ${byNote}`,
  });

  return confirm;
}

// ── Modals ────────────────────────────────────────────────────────────────────
export const CREATE_MODAL_CALLBACK = "po_create";
export const ETA_MODAL_CALLBACK = "po_update_eta";

export function buildCreateModal(prefillDescription = ""): SlackBlock {
  return {
    type: "modal",
    callback_id: CREATE_MODAL_CALLBACK,
    title: { type: "plain_text", text: "Vendor Order" },
    submit: { type: "plain_text", text: "Create" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input", block_id: "desc",
        label: { type: "plain_text", text: "What do you need?" },
        element: { type: "plain_text_input", action_id: "v", multiline: true, initial_value: prefillDescription.slice(0, 2900) },
      },
      {
        type: "input", block_id: "material", optional: true,
        label: { type: "plain_text", text: "Material" },
        element: { type: "plain_text_input", action_id: "v" },
      },
      {
        type: "input", block_id: "qty", optional: true,
        label: { type: "plain_text", text: "Quantity" },
        element: { type: "plain_text_input", action_id: "v", placeholder: { type: "plain_text", text: "3 pallets / 1 roll" } },
      },
      {
        type: "input", block_id: "priority",
        label: { type: "plain_text", text: "Priority" },
        element: {
          type: "static_select", action_id: "v",
          initial_option: { text: { type: "plain_text", text: "Normal" }, value: "normal" },
          options: [
            { text: { type: "plain_text", text: "Low" }, value: "low" },
            { text: { type: "plain_text", text: "Normal" }, value: "normal" },
            { text: { type: "plain_text", text: "High" }, value: "high" },
            { text: { type: "plain_text", text: "Urgent" }, value: "urgent" },
          ],
        },
      },
    ],
  };
}

export function buildEtaModal(orderId: string): SlackBlock {
  return {
    type: "modal",
    callback_id: ETA_MODAL_CALLBACK,
    private_metadata: orderId,
    title: { type: "plain_text", text: "Update ETA" },
    submit: { type: "plain_text", text: "Save" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input", block_id: "eta",
        label: { type: "plain_text", text: "Estimated arrival" },
        element: { type: "datepicker", action_id: "v" },
      },
    ],
  };
}

// ── Digest block builder ──────────────────────────────────────────────────────
export type DigestLine = { id: string; text: string; actions?: PoAction[] };
export type DigestSection = { heading: string; emoji: string; lines: DigestLine[] };

export const OVERFLOW_ACTION_ID = "po_overflow";

function lineBlock(l: DigestLine): SlackBlock {
  const block: SlackBlock = { type: "section", text: { type: "mrkdwn", text: `${l.text}  <${orderUrl(l.id)}|open>` } };
  const options: SlackBlock[] = [];
  for (const a of l.actions ?? []) {
    options.push({ text: { type: "plain_text", text: ACTION_LABEL[a] }, value: `${a}:${l.id}` });
  }
  if (options.length) {
    block.accessory = { type: "overflow", action_id: OVERFLOW_ACTION_ID, options };
  }
  return block;
}

function sectionBlocks(s: DigestSection): SlackBlock[] {
  if (s.lines.length === 0) return [];
  return [
    { type: "section", text: { type: "mrkdwn", text: `*${s.emoji} ${s.heading}*  _(${s.lines.length})_` } },
    ...s.lines.slice(0, 12).map(lineBlock),
    ...(s.lines.length > 12 ? [{ type: "context", elements: [{ type: "mrkdwn", text: `…and ${s.lines.length - 12} more` }] }] : []),
  ];
}

export function buildDigestBlocks(sections: {
  overdue: DigestLine[];
  needsOrdering: DigestLine[];
  waitingOnVendor: DigestLine[];
  inTransit: DigestLine[];
  upcomingPayments: DigestLine[];
}): { text: string; blocks: SlackBlock[] } {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const blocks: SlackBlock[] = [
    { type: "header", text: { type: "plain_text", text: `Vendor Orders — ${today}`, emoji: true } },
  ];

  const total =
    sections.overdue.length + sections.needsOrdering.length + sections.waitingOnVendor.length +
    sections.inTransit.length + sections.upcomingPayments.length;

  if (total === 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "✅ Nothing needs attention today. All vendor orders are on track." } });
    return { text: "Vendor Orders: all clear today", blocks };
  }

  blocks.push(...sectionBlocks({ heading: "Overdue — needs attention", emoji: "🚨", lines: sections.overdue }));
  if (sections.overdue.length) blocks.push({ type: "divider" });
  blocks.push(...sectionBlocks({ heading: "Needs Ordering", emoji: "📝", lines: sections.needsOrdering }));
  blocks.push(...sectionBlocks({ heading: "Waiting on Vendor", emoji: "⏳", lines: sections.waitingOnVendor }));
  blocks.push(...sectionBlocks({ heading: "In Transit", emoji: "🚚", lines: sections.inTransit }));
  blocks.push(...sectionBlocks({ heading: "Upcoming Payments (next 7 days)", emoji: "💵", lines: sections.upcomingPayments }));
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `<${APP_URL}/operations/vendor-orders|Open Vendor Orders →>` }] });

  return { text: `Vendor Orders digest — ${total} item${total === 1 ? "" : "s"} need attention`, blocks };
}
