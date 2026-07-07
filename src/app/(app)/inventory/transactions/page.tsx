import Link from "next/link";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { InvTransaction, InvRoll, InvJob } from "@/lib/db-helpers.types";

const TYPE_COLORS: Record<string, string> = {
  receive:    "bg-brand-tint text-brand",
  cut:        "bg-info-tint text-info",
  dispatch:   "bg-info-tint text-info",
  return:     "bg-warn-tint text-warn",
  adjust:     "bg-warn-tint text-warn",
  scrap:      "bg-danger-tint text-danger",
  transfer:   "bg-sunken text-ink-2",
  allocate:   "bg-info-tint text-info",
  reserve:    "bg-info-tint text-info",
  stage:      "bg-info-tint text-info",
  consume:    "bg-sunken text-ink-2",
};

const PAGE_SIZE = 50;

export default async function InventoryTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    date_from?: string;
    date_to?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const type = params.type ?? "all";
  const dateFrom = params.date_from ?? "";
  const dateTo = params.date_to ?? "";
  const q = params.q ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  const supabase = await createClient();

  // Build base query
  let query = supabase
    .from("inv_transactions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (type && type !== "all") query = query.eq("transaction_type", type);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) {
    // include the end-day fully
    const end = new Date(dateTo);
    end.setDate(end.getDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }
  if (q) {
    const safe = q.replace(/[%,()]/g, "");
    query = query.or(`notes.ilike.%${safe}%,transaction_type.ilike.%${safe}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: txRaw, count } = await query.range(from, to);
  const transactions = (txRaw ?? []) as InvTransaction[];

  // Distinct types from a quick second query (small lookup)
  const { data: allTypesRaw } = await supabase
    .from("inv_transactions")
    .select("transaction_type");
  const typeSet = new Set<string>();
  for (const t of allTypesRaw ?? []) {
    if (t.transaction_type) typeSet.add(t.transaction_type);
  }
  const types = [...typeSet].sort();

  // Hydrate roll / job / creator labels
  const rollIds = [...new Set(transactions.map((t) => t.roll_id).filter(Boolean) as string[])];
  const jobIds = [...new Set(transactions.map((t) => t.job_id).filter(Boolean) as string[])];
  const userIds = [...new Set(transactions.map((t) => t.created_by).filter(Boolean) as string[])];

  const [rollsRes, jobsRes, profilesRes] = await Promise.all([
    rollIds.length > 0
      ? supabase.from("inv_rolls").select("id, tt_sku_tag_number, product_name").in("id", rollIds)
      : Promise.resolve({ data: [] }),
    jobIds.length > 0
      ? supabase.from("inv_jobs").select("id, job_number, job_name").in("id", jobIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const rollMap = new Map<string, Pick<InvRoll, "id" | "tt_sku_tag_number" | "product_name">>();
  for (const r of (rollsRes.data ?? []) as unknown as Pick<InvRoll, "id" | "tt_sku_tag_number" | "product_name">[]) {
    rollMap.set(r.id, r);
  }
  const jobMap = new Map<string, Pick<InvJob, "id" | "job_number" | "job_name">>();
  for (const j of (jobsRes.data ?? []) as unknown as Pick<InvJob, "id" | "job_number" | "job_name">[]) {
    jobMap.set(j.id, j);
  }
  const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
  for (const p of (profilesRes.data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
    profileMap.set(p.id, { full_name: p.full_name, email: p.email });
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function withParams(updates: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (type && type !== "all") p.set("type", type);
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    if (q) p.set("q", q);
    if (page > 1) p.set("page", String(page));
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    }
    const str = p.toString();
    return `/inventory/transactions${str ? `?${str}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        ← Inventory
      </Link>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Transaction Log</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            {total.toLocaleString()} transaction{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end card p-4">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Type</label>
          <select
            name="type"
            defaultValue={type}
            className="field-input w-auto"
          >
            <option value="all">All Types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">From</label>
          <input
            type="date"
            name="date_from"
            defaultValue={dateFrom}
            className="field-input w-auto"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">To</label>
          <input
            type="date"
            name="date_to"
            defaultValue={dateTo}
            className="field-input w-auto"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-ink-3 mb-1">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search notes…"
            className="field-input"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
        >
          Filter
        </button>
        {(type !== "all" || dateFrom || dateTo || q) && (
          <Link
            href="/inventory/transactions"
            className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="card overflow-x-auto">
        {transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-4">
            No transactions found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-hover">
                <th className="text-left px-4 py-3 font-semibold text-ink-2 whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Roll</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Job</th>
                <th className="text-right px-4 py-3 font-semibold text-ink-2">Qty (ft)</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Notes</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {transactions.map((tx) => {
                const roll = tx.roll_id ? rollMap.get(tx.roll_id) : null;
                const job = tx.job_id ? jobMap.get(tx.job_id) : null;
                const profile = tx.created_by ? profileMap.get(tx.created_by) : null;
                const colorCls = TYPE_COLORS[tx.transaction_type] ?? "bg-sunken text-ink-2";

                return (
                  <tr key={tx.id} className="hover:bg-hover">
                    <td className="px-4 py-3 text-xs text-ink-3 whitespace-nowrap font-mono">
                      {format(parseISO(tx.created_at), "MMM d, HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colorCls}`}>
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {roll ? (
                        <Link
                          href={`/inventory/rolls/${roll.id}`}
                          className="text-ink hover:underline font-mono text-xs"
                        >
                          {roll.tt_sku_tag_number ?? roll.id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {job ? (
                        <Link
                          href={`/inventory/jobs/${job.id}`}
                          className="text-ink hover:underline text-xs"
                        >
                          {job.job_number ?? job.job_name}
                        </Link>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2">
                      {tx.quantity_ft != null ? tx.quantity_ft : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-3">
                      {tx.from_status || tx.to_status ? (
                        <>
                          {tx.from_status ?? "—"}
                          <span className="mx-1 text-ink-4">→</span>
                          {tx.to_status ?? "—"}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-3 max-w-xs truncate">
                      {tx.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-3">
                      {profile?.full_name ?? profile?.email ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-3">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={withParams({ page: String(page - 1) })}
                className="px-3 py-1.5 text-sm font-medium border border-line rounded-lg bg-white hover:bg-hover"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={withParams({ page: String(page + 1) })}
                className="px-3 py-1.5 text-sm font-medium border border-line rounded-lg bg-white hover:bg-hover"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
