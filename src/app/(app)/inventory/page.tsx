import { createClient } from "@/lib/supabase/server";
import { formatDistanceToNowStrict } from "date-fns";
import type {
  InvRoll,
  InvJob,
  InvTransaction,
  InvItem,
  RollStatus,
} from "@/lib/database.types";

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
  available:  "bg-green-50 text-green-700 border-green-200",
  planned:    "bg-purple-50 text-purple-700 border-purple-200",
  allocated:  "bg-blue-50 text-blue-700 border-blue-200",
  staged:     "bg-blue-50 text-blue-700 border-blue-200",
  dispatched: "bg-amber-50 text-amber-800 border-amber-200",
  consumed:   "bg-zinc-50 text-zinc-600 border-zinc-200",
  damaged:    "bg-zinc-50 text-zinc-600 border-zinc-200",
  returned:   "bg-zinc-50 text-zinc-600 border-zinc-200",
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
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Inventory Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Roll inventory, jobs, and stock at a glance.
          </p>
        </div>
      </div>

      {/* Stat row */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
            Total Active Rolls
          </p>
          <p className="text-2xl font-bold text-zinc-900">
            {fmtInt(totalActiveRolls)}
          </p>
          <p className="text-xs text-zinc-400 mt-1">In active lifecycle</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
            Linear Feet In Stock
          </p>
          <p className="text-2xl font-bold text-zinc-900">
            {fmtFt(totalInStockFt)}
            <span className="text-sm font-normal text-zinc-400 ml-1">ft</span>
          </p>
          <p className="text-xs text-zinc-400 mt-1">Available + allocated</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
            Active Jobs
          </p>
          <p className="text-2xl font-bold text-zinc-900">
            {fmtInt(activeJobsCount)}
          </p>
          <p className="text-xs text-zinc-400 mt-1">Not completed or archived</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
            Open Allocations
          </p>
          <p className="text-2xl font-bold text-zinc-900">
            {fmtInt(openAllocationsCount)}
          </p>
          <p className="text-xs text-zinc-400 mt-1">Awaiting fulfillment</p>
        </div>
      </section>

      {/* Two cards: Recent Activity + Low Stock */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Recent Activity</h2>
            <span className="text-xs text-zinc-400">Last 10</span>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-zinc-400">No transactions yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {transactions.map((tx) => {
                const roll = tx.roll_id ? rollLookup.get(tx.roll_id) : null;
                const job = tx.job_id ? jobLookup.get(tx.job_id) : null;
                const rollLabel = roll
                  ? roll.tt_sku_tag_number ?? roll.product_name ?? `Roll ${roll.id.slice(0, 6)}`
                  : null;
                const jobLabel = job ? job.job_name ?? job.job_number ?? null : null;

                return (
                  <li key={tx.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 text-xs font-semibold capitalize whitespace-nowrap">
                      {tx.transaction_type.replace(/_/g, " ")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-800 truncate">
                        {rollLabel ?? <span className="text-zinc-400">No roll</span>}
                        {jobLabel && (
                          <>
                            {" "}
                            <span className="text-zinc-400">→</span>{" "}
                            <span className="text-zinc-600">{jobLabel}</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-zinc-400">{relativeTime(tx.created_at)}</p>
                    </div>
                    {tx.quantity_ft !== null && tx.quantity_ft !== undefined && (
                      <span className="text-sm font-medium text-zinc-700 whitespace-nowrap">
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
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Low Stock Alert</h2>
            <span className="text-xs text-zinc-400">
              {lowStockItems.length} item{lowStockItems.length === 1 ? "" : "s"}
            </span>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-zinc-400">All stock levels are healthy.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {lowStockItems.map((item) => (
                <li key={item.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-800 truncate">{item.name}</p>
                    <p className="text-xs text-zinc-400">
                      Min: {fmtInt(item.min_quantity)} {item.unit}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-xs font-semibold whitespace-nowrap">
                    {fmtInt(item.quantity)} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Rolls by status */}
      <section className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Rolls by Status</h2>
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
