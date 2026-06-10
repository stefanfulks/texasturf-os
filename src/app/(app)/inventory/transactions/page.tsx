import Link from "next/link";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { InvTransaction, InvRoll, InvJob } from "@/lib/db-helpers.types";

const TYPE_COLORS: Record<string, string> = {
  receive:    "bg-emerald-50 text-emerald-700",
  cut:        "bg-purple-50 text-purple-700",
  dispatch:   "bg-blue-50 text-blue-700",
  return:     "bg-orange-50 text-orange-700",
  adjust:     "bg-amber-50 text-amber-700",
  scrap:      "bg-red-50 text-red-700",
  transfer:   "bg-zinc-100 text-zinc-700",
  allocate:   "bg-indigo-50 text-indigo-700",
  reserve:    "bg-violet-50 text-violet-700",
  stage:      "bg-sky-50 text-sky-700",
  consume:    "bg-zinc-100 text-zinc-700",
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
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
        ← Inventory
      </Link>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transaction Log</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {total.toLocaleString()} transaction{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end rounded-xl border border-zinc-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Type</label>
          <select
            name="type"
            defaultValue={type}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
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
          <label className="block text-xs font-medium text-zinc-500 mb-1">From</label>
          <input
            type="date"
            name="date_from"
            defaultValue={dateFrom}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">To</label>
          <input
            type="date"
            name="date_to"
            defaultValue={dateTo}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-zinc-500 mb-1">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search notes…"
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700"
        >
          Filter
        </button>
        {(type !== "all" || dateFrom || dateTo || q) && (
          <Link
            href="/inventory/transactions"
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        {transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">
            No transactions found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-semibold text-zinc-600 whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Roll</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Job</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Qty (ft)</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Notes</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {transactions.map((tx) => {
                const roll = tx.roll_id ? rollMap.get(tx.roll_id) : null;
                const job = tx.job_id ? jobMap.get(tx.job_id) : null;
                const profile = tx.created_by ? profileMap.get(tx.created_by) : null;
                const colorCls = TYPE_COLORS[tx.transaction_type] ?? "bg-zinc-100 text-zinc-700";

                return (
                  <tr key={tx.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap font-mono">
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
                          className="text-zinc-800 hover:underline font-mono text-xs"
                        >
                          {roll.tt_sku_tag_number ?? roll.id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {job ? (
                        <Link
                          href={`/inventory/jobs/${job.id}`}
                          className="text-zinc-800 hover:underline text-xs"
                        >
                          {job.job_number ?? job.job_name}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700">
                      {tx.quantity_ft != null ? tx.quantity_ft : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {tx.from_status || tx.to_status ? (
                        <>
                          {tx.from_status ?? "—"}
                          <span className="mx-1 text-zinc-400">→</span>
                          {tx.to_status ?? "—"}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs truncate">
                      {tx.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
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
          <p className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={withParams({ page: String(page - 1) })}
                className="px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={withParams({ page: String(page + 1) })}
                className="px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50"
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
