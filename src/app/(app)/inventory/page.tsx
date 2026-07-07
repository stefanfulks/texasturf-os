import { createClient } from "@/lib/supabase/server";
import { formatDistanceToNowStrict } from "date-fns";
import { Layers, Ruler, ClipboardList, ArrowRightLeft, Activity, CheckCircle2 } from "lucide-react";
import type {
  InvRoll,
  InvJob,
  InvTransaction,
  InvItem,
  RollStatus,
} from "@/lib/db-helpers.types";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_ROLL_STATUSES: RollStatus[] = [
  "available",
  "planned",
  "allocated",
  "staged",
  "dispatched",
];

const IN_STOCK_ROLL_STATUSES: RollStatus[] = ["available", "allocated"];

const INACTIVE_JOB_STATUSES = ["completed", "archived"];
const INACTIVE_ALLOCATION_STATUSES = ["completed", "cancelled"];

const ALL_ROLL_STATUSES: RollStatus[] = [
  "available",
  "planned",
  "allocated",
  "staged",
  "dispatched",
  "consumed",
  "damaged",
  "returned",
];

const STATUS_COLORS: Record<RollStatus, string> = {
  available:  "bg-brand-tint text-brand border-brand/30",
  planned:    "bg-info-tint text-info border-info/30",
  allocated:  "bg-info-tint text-info border-info/30",
  staged:     "bg-info-tint text-info border-info/30",
  dispatched: "bg-warn-tint text-warn border-warn/30",
  consumed:   "bg-hover text-ink-2 border-line",
  damaged:    "bg-hover text-ink-2 border-line",
  returned:   "bg-hover text-ink-2 border-line",
};

const STATUS_LABELS: Record<RollStatus, string> = {
  available:  "Available",
  planned:    "Planned",
  allocated:  "Allocated",
  staged:     "Staged",
  dispatched: "Dispatched",
  consumed:   "Consumed",
  damaged:    "Damaged",
  returned:   "Returned",
};

function fmtInt(n: number) {
  return n.toLocaleString("en-US");
}

function fmtFt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function relativeTime(iso: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function InventoryDashboardPage() {
  const supabase = await createClient();

  // Fetch the core datasets in parallel. Auth + role check happens in layout.
  const [
    rollsResult,
    jobsActiveResult,
    allocationsOpenResult,
    transactionsResult,
    itemsResult,
  ] = await Promise.all([
    supabase
      .from("inv_rolls")
      .select("id, status, current_length_ft, allocated_job_id"),
    supabase
      .from("inv_jobs")
      .select("id", { count: "exact", head: true })
      .not("status", "in", `(${INACTIVE_JOB_STATUSES.join(",")})`),
    supabase
      .from("inv_allocations")
      .select("id", { count: "exact", head: true })
      .not("status", "in", `(${INACTIVE_ALLOCATION_STATUSES.join(",")})`),
    supabase
      .from("inv_transactions")
      .select("id, transaction_type, roll_id, job_id, quantity_ft, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("inv_items")
      .select("id, name, quantity, unit, min_quantity")
      .eq("active", true),
  ]);

  const rolls = (rollsResult.data ?? []) as Pick<
    InvRoll,
    "id" | "status" | "current_length_ft" | "allocated_job_id"
  >[];

  const activeJobsCount = jobsActiveResult.count ?? 0;
  const openAllocationsCount = allocationsOpenResult.count ?? 0;

  const transactions = (transactionsResult.data ?? []) as Pick<
    InvTransaction,
    "id" | "transaction_type" | "roll_id" | "job_id" | "quantity_ft" | "created_at"
  >[];

  const items = (itemsResult.data ?? []) as Pick<
    InvItem,
    "id" | "name" | "quantity" | "unit" | "min_quantity"
  >[];

  // ── Stat aggregations ──────────────────────────────────────
  const totalActiveRolls = rolls.filter((r) =>
    ACTIVE_ROLL_STATUSES.includes(r.status),
  ).length;

  const totalInStockFt = rolls
    .filter((r) => IN_STOCK_ROLL_STATUSES.includes(r.status))
    .reduce((sum, r) => sum + (r.current_length_ft ?? 0), 0);

  const lowStockItems = items.filter((i) => i.quantity <= i.min_quantity);

  const rollsByStatus = ALL_ROLL_STATUSES.reduce<Record<RollStatus, number>>(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<RollStatus, number>,
  );
  for (const r of rolls) {
    rollsByStatus[r.status] = (rollsByStatus[r.status] ?? 0) + 1;
  }

  // ── Hydrate transaction display data ───────────────────────
  const txRollIds = [
    ...new Set(transactions.map((t) => t.roll_id).filter(Boolean) as string[]),
  ];
  const txJobIds = [
    ...new Set(transactions.map((t) => t.job_id).filter(Boolean) as string[]),
  ];

  const [rollLookupResult, jobLookupResult] = await Promise.all([
    txRollIds.length > 0
      ? supabase
          .from("inv_rolls")
          .select("id, tt_sku_tag_number, product_name")
          .in("id", txRollIds)
      : Promise.resolve({ data: [] }),
    txJobIds.length > 0
      ? supabase
          .from("inv_jobs")
          .select("id, job_number, job_name")
          .in("id", txJobIds)
      : Promise.resolve({ data: [] }),
  ]);

  const rollLookup = new Map<
    string,
    Pick<InvRoll, "id" | "tt_sku_tag_number" | "product_name">
  >();
  for (const r of (rollLookupResult.data ?? []) as unknown as Pick<
    InvRoll,
    "id" | "tt_sku_tag_number" | "product_name"
  >[]) {
    rollLookup.set(r.id, r);
  }

  const jobLookup = new Map<
    string,
    Pick<InvJob, "id" | "job_number" | "job_name">
  >();
  for (const j of (jobLookupResult.data ?? []) as unknown as Pick<
    InvJob,
    "id" | "job_number" | "job_name"
  >[]) {
    jobLookup.set(j.id, j);
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="reveal flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Warehouse</p>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">Roll inventory, jobs, and stock at a glance.</p>
        </div>
      </header>

      {/* Stat row */}
      <section className="reveal grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <div className="stat">
          <div className="flex items-start justify-between">
            <span className="stat-label">Active rolls</span>
            <span className="medallion medallion-brand !h-7 !w-7 !rounded-[9px]">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <span className="stat-value">{fmtInt(totalActiveRolls)}</span>
          <span className="stat-foot">In active lifecycle</span>
        </div>

        <div className="stat">
          <div className="flex items-start justify-between">
            <span className="stat-label">Linear feet in stock</span>
            <span className="medallion medallion-brand !h-7 !w-7 !rounded-[9px]">
              <Ruler className="h-4 w-4" />
            </span>
          </div>
          <span className="stat-value">
            {fmtFt(totalInStockFt)}
            <span className="ml-1 text-sm font-normal text-ink-4">ft</span>
          </span>
          <span className="stat-foot">Available + allocated</span>
        </div>

        <div className="stat">
          <div className="flex items-start justify-between">
            <span className="stat-label">Active jobs</span>
            <span className="medallion medallion-brand !h-7 !w-7 !rounded-[9px]">
              <ClipboardList className="h-4 w-4" />
            </span>
          </div>
          <span className="stat-value">{fmtInt(activeJobsCount)}</span>
          <span className="stat-foot">Not completed or archived</span>
        </div>

        <div className={"stat" + (openAllocationsCount > 0 ? " stat-accent-warn" : "")}>
          <div className="flex items-start justify-between">
            <span className="stat-label">Open allocations</span>
            <span className={"medallion !h-7 !w-7 !rounded-[9px] " + (openAllocationsCount > 0 ? "medallion-warn" : "medallion-brand")}>
              <ArrowRightLeft className="h-4 w-4" />
            </span>
          </div>
          <span className="stat-value">{fmtInt(openAllocationsCount)}</span>
          <span className="stat-foot">Awaiting fulfillment</span>
        </div>
      </section>

      {/* Two panels: Recent Activity + Low Stock */}
      <section className="reveal grid grid-cols-1 gap-3 lg:grid-cols-2" style={{ animationDelay: "120ms" }}>
        {/* Recent Activity */}
        <div className="panel">
          <div className="panel-head">
            <h2 className="text-sm font-semibold text-ink">Recent activity</h2>
            <span className="text-xs text-ink-3">Last 10</span>
          </div>
          {transactions.length === 0 ? (
            <div className="empty-state">
              <span className="medallion"><Activity className="h-5 w-5" /></span>
              <p className="empty-state-title">No transactions yet</p>
              <p className="empty-state-body">Receiving, cuts, and dispatches will appear here as they happen.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {transactions.map((tx) => {
                const roll = tx.roll_id ? rollLookup.get(tx.roll_id) : null;
                const job = tx.job_id ? jobLookup.get(tx.job_id) : null;
                const rollLabel = roll
                  ? roll.tt_sku_tag_number ?? roll.product_name ?? `Roll ${roll.id.slice(0, 6)}`
                  : null;
                const jobLabel = job ? job.job_name ?? job.job_number ?? null : null;

                return (
                  <li key={tx.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sunken text-ink-2 text-xs font-semibold capitalize whitespace-nowrap">
                      {tx.transaction_type.replace(/_/g, " ")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink truncate">
                        {rollLabel ?? <span className="text-ink-4">No roll</span>}
                        {jobLabel && (
                          <>
                            {" "}
                            <span className="text-ink-4">→</span>{" "}
                            <span className="text-ink-2">{jobLabel}</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-ink-4">{relativeTime(tx.created_at)}</p>
                    </div>
                    {tx.quantity_ft !== null && tx.quantity_ft !== undefined && (
                      <span className="text-sm font-medium text-ink-2 whitespace-nowrap">
                        {fmtFt(tx.quantity_ft)} ft
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="panel">
          <div className="panel-head">
            <h2 className="text-sm font-semibold text-ink">Low stock alert</h2>
            <span className={"chip " + (lowStockItems.length > 0 ? "chip-danger" : "chip-neutral")}>
              {lowStockItems.length} item{lowStockItems.length === 1 ? "" : "s"}
            </span>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="empty-state">
              <span className="medallion medallion-brand"><CheckCircle2 className="h-5 w-5" /></span>
              <p className="empty-state-title">All stock levels are healthy</p>
              <p className="empty-state-body">Items dipping below their minimum will surface here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {lowStockItems.map((item) => (
                <li key={item.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                    <p className="text-xs text-ink-4">
                      Min: {fmtInt(item.min_quantity)} {item.unit}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-danger-tint text-danger text-xs font-semibold whitespace-nowrap">
                    {fmtInt(item.quantity)} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Rolls by status */}
      <section className="panel reveal" style={{ animationDelay: "180ms" }}>
        <div className="panel-head">
          <h2 className="text-sm font-semibold text-ink">Rolls by status</h2>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {ALL_ROLL_STATUSES.map((status) => (
            <div
              key={status}
              className={
                "rounded-lg border p-3 text-center " + STATUS_COLORS[status]
              }
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {STATUS_LABELS[status]}
              </p>
              <p className="text-xl font-bold mt-1">
                {fmtInt(rollsByStatus[status] ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
