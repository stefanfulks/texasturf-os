import Link from "next/link";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type {
  InvJob,
  InvAllocation,
  InvTransaction,
} from "@/lib/database.types";

function varianceColor(pct: number): string {
  const abs = Math.abs(pct);
  if (abs <= 5) return "text-green-700";
  if (abs <= 15) return "text-amber-700";
  return "text-red-700";
}

export default async function TurfOverageReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date_from?: string; date_to?: string; status?: string }>;
}) {
  const { date_from, date_to, status } = await searchParams;
  const effectiveStatus = status ?? "completed";

  const supabase = await createClient();

  // Build jobs query
  let jobsQuery = supabase
    .from("inv_jobs")
    .select("id, job_number, job_name, status, completion_date, created_at")
    .order("completion_date", { ascending: false, nullsFirst: false });

  if (effectiveStatus !== "all") jobsQuery = jobsQuery.eq("status", effectiveStatus);

  if (date_from) jobsQuery = jobsQuery.gte("completion_date", date_from);
  if (date_to) jobsQuery = jobsQuery.lte("completion_date", date_to);

  const { data: jobsRaw } = await jobsQuery;
  const jobs = (jobsRaw ?? []) as Pick<
    InvJob,
    "id" | "job_number" | "job_name" | "status" | "completion_date" | "created_at"
  >[];

  const jobIds = jobs.map((j) => j.id);

  const [allocationsRes, transactionsRes] = await Promise.all([
    jobIds.length > 0
      ? supabase
          .from("inv_allocations")
          .select("job_id, requested_length_ft")
          .in("job_id", jobIds)
      : Promise.resolve({ data: [] }),
    jobIds.length > 0
      ? supabase
          .from("inv_transactions")
          .select("job_id, quantity_ft, transaction_type")
          .in("job_id", jobIds)
          .eq("transaction_type", "dispatch")
      : Promise.resolve({ data: [] }),
  ]);

  const requestedByJob = new Map<string, number>();
  for (const a of (allocationsRes.data ?? []) as Pick<InvAllocation, "job_id" | "requested_length_ft">[]) {
    requestedByJob.set(
      a.job_id,
      (requestedByJob.get(a.job_id) ?? 0) + (a.requested_length_ft ?? 0),
    );
  }

  const dispatchedByJob = new Map<string, number>();
  for (const t of (transactionsRes.data ?? []) as Pick<InvTransaction, "job_id" | "quantity_ft" | "transaction_type">[]) {
    if (!t.job_id) continue;
    dispatchedByJob.set(
      t.job_id,
      (dispatchedByJob.get(t.job_id) ?? 0) + (t.quantity_ft ?? 0),
    );
  }

  const rows = jobs.map((job) => {
    const requested = requestedByJob.get(job.id) ?? 0;
    const dispatched = dispatchedByJob.get(job.id) ?? 0;
    const variance = dispatched - requested;
    const variancePct = requested > 0 ? (variance / requested) * 100 : 0;
    return {
      job,
      requested,
      dispatched,
      variance,
      variancePct,
    };
  });

  const withRequested = rows.filter((r) => r.requested > 0);

  const totalOver = withRequested.filter((r) => r.variance > 0).length;
  const totalUnder = withRequested.filter((r) => r.variance < 0).length;
  const avgVariancePct =
    withRequested.length > 0
      ? withRequested.reduce((s, r) => s + r.variancePct, 0) / withRequested.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Turf Overage Report</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Requested vs dispatched feet per job
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end rounded-xl border border-zinc-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Status</label>
          <select
            name="status"
            defaultValue={effectiveStatus}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
          >
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="all">All</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">From</label>
          <input
            type="date"
            name="date_from"
            defaultValue={date_from ?? ""}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">To</label>
          <input
            type="date"
            name="date_to"
            defaultValue={date_to ?? ""}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700"
        >
          Filter
        </button>
        {(date_from || date_to || (status && status !== "completed")) && (
          <Link
            href="/inventory/reports/overage"
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Jobs</p>
          <p className="text-2xl font-semibold text-zinc-900">{withRequested.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Over</p>
          <p className="text-2xl font-semibold text-red-700">{totalOver}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Under</p>
          <p className="text-2xl font-semibold text-green-700">{totalUnder}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Avg Variance</p>
          <p className={`text-2xl font-semibold ${varianceColor(avgVariancePct)}`}>
            {avgVariancePct > 0 ? "+" : ""}
            {avgVariancePct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">
            No jobs match the filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Job #</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Completion</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Requested</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Dispatched</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Variance (ft)</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Variance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map(({ job, requested, dispatched, variance, variancePct }) => {
                const color = requested > 0 ? varianceColor(variancePct) : "text-zinc-400";
                return (
                  <tr key={job.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/inventory/jobs/${job.id}`}
                        className="text-zinc-800 hover:underline"
                      >
                        {job.job_number ?? job.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{job.job_name}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                      {job.completion_date
                        ? format(parseISO(job.completion_date), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700">
                      {Math.round(requested).toLocaleString()} ft
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700">
                      {Math.round(dispatched).toLocaleString()} ft
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${color}`}>
                      {variance > 0 ? "+" : ""}
                      {Math.round(variance).toLocaleString()} ft
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${color}`}>
                      {requested > 0 ? (
                        <>
                          {variancePct > 0 ? "+" : ""}
                          {variancePct.toFixed(1)}%
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
