import type {
  PoStatus,
  PoPriority,
  PoPurchaseType,
  PoPaymentTerms,
  PoPaymentStatus,
} from "@/lib/db-helpers.types";

// ── Lifecycle stages ─────────────────────────────────────────────────────────
// One Status column drives the whole module. `order` is the canonical pipeline
// order; `group` collapses the 12 stages into a handful of board lanes so the
// list/board isn't 12 near-empty columns.

export type StageGroup = "Intake" | "Sourcing" | "Ordered" | "Receiving" | "Done";

type StageMeta = {
  label: string;
  badge: string;        // tailwind token classes for the status pill
  group: StageGroup;
  open: boolean;        // counts toward "active" work
};

export const STAGE_META: Record<PoStatus, StageMeta> = {
  new_request:         { label: "New Request",         badge: "bg-sunken text-ink-2",   group: "Intake",    open: true },
  awaiting_review:     { label: "Awaiting Review",     badge: "bg-info-tint text-info", group: "Intake",    open: true },
  awaiting_approval:   { label: "Awaiting Approval",   badge: "bg-warn-tint text-warn", group: "Sourcing",  open: true },
  quote_gathering:     { label: "Quote Gathering",     badge: "bg-info-tint text-info", group: "Sourcing",  open: true },
  ready_to_order:      { label: "Ready to Order",      badge: "bg-brand-tint text-brand", group: "Sourcing", open: true },
  order_placed:        { label: "Order Placed",        badge: "bg-info-tint text-info", group: "Ordered",   open: true },
  waiting_on_vendor:   { label: "Waiting on Vendor",   badge: "bg-warn-tint text-warn", group: "Ordered",   open: true },
  in_transit:          { label: "In Transit",          badge: "bg-info-tint text-info", group: "Ordered",   open: true },
  delivered:           { label: "Delivered",           badge: "bg-brand-tint text-brand", group: "Receiving", open: true },
  payment_outstanding: { label: "Payment Outstanding", badge: "bg-warn-tint text-warn", group: "Receiving", open: true },
  closed:              { label: "Closed",              badge: "bg-hover text-ink-3",    group: "Done",      open: false },
  cancelled:           { label: "Cancelled",           badge: "bg-hover text-ink-4",    group: "Done",      open: false },
};

// Canonical pipeline order (matches the enum).
export const STAGE_ORDER: PoStatus[] = [
  "new_request",
  "awaiting_review",
  "awaiting_approval",
  "quote_gathering",
  "ready_to_order",
  "order_placed",
  "waiting_on_vendor",
  "in_transit",
  "delivered",
  "payment_outstanding",
  "closed",
  "cancelled",
];

export const GROUP_ORDER: StageGroup[] = ["Intake", "Sourcing", "Ordered", "Receiving", "Done"];

export function stageLabel(s: PoStatus): string {
  return STAGE_META[s].label;
}
export function stageBadge(s: PoStatus): string {
  return STAGE_META[s].badge;
}
export function isOpenStage(s: PoStatus): boolean {
  return STAGE_META[s].open;
}

// ── Priority ─────────────────────────────────────────────────────────────────
export const PRIORITY_META: Record<PoPriority, { label: string; badge: string }> = {
  low:    { label: "Low",    badge: "bg-hover text-ink-4" },
  normal: { label: "Normal", badge: "bg-sunken text-ink-3" },
  high:   { label: "High",   badge: "bg-warn-tint text-warn" },
  urgent: { label: "Urgent", badge: "bg-danger-tint text-danger" },
};
export const PRIORITY_OPTIONS: [PoPriority, string][] = [
  ["low", "Low"], ["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"],
];

// ── Purchase type ────────────────────────────────────────────────────────────
export const PURCHASE_TYPE_LABELS: Record<PoPurchaseType, string> = {
  inventory_replenishment: "Inventory Replenishment",
  project_specific:        "Project Specific",
};
export const PURCHASE_TYPE_OPTIONS: [PoPurchaseType, string][] = [
  ["inventory_replenishment", "Inventory Replenishment"],
  ["project_specific",        "Project Specific"],
];

// ── Payment terms ────────────────────────────────────────────────────────────
export const PAYMENT_TERMS_LABELS: Record<PoPaymentTerms, string> = {
  paid_in_full:    "Paid in Full",
  deposit:         "Deposit",
  net_15:          "Net 15",
  net_30:          "Net 30",
  net_45:          "Net 45",
  due_on_delivery: "Due Upon Delivery",
  other:           "Other",
};
export const PAYMENT_TERMS_OPTIONS: [PoPaymentTerms, string][] = [
  ["paid_in_full", "Paid in Full"],
  ["deposit", "Deposit Paid"],
  ["net_15", "Net 15"],
  ["net_30", "Net 30"],
  ["net_45", "Net 45"],
  ["due_on_delivery", "Due Upon Delivery"],
  ["other", "Other"],
];

// ── Payment status ───────────────────────────────────────────────────────────
export const PAYMENT_STATUS_META: Record<PoPaymentStatus, { label: string; badge: string }> = {
  not_due:  { label: "Not Due",  badge: "bg-sunken text-ink-3" },
  due_soon: { label: "Due Soon", badge: "bg-warn-tint text-warn" },
  past_due: { label: "Past Due", badge: "bg-danger-tint text-danger" },
  paid:     { label: "Paid",     badge: "bg-brand-tint text-brand" },
};

// ── Formatting helpers ───────────────────────────────────────────────────────
export function poNumber(seq: number): string {
  return `PO-${String(seq).padStart(4, "0")}`;
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  // date columns come back as 'YYYY-MM-DD' — render without TZ shifting.
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return "—";
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
