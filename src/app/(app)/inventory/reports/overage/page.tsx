import Link from "next/link";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type {
  InvJob,
  InvAllocation,
  InvTransaction,
} from "@/lib/db-helpers.types";

function varianceColor(pct: number): string {
  const abs = Math.abs(pct);
  if (abs <= 5) return "text-brand";
  if (abs <= 15) return "text-warn";
  return "text-danger";
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
          <p className="text-sm text-ink-3 mt-0.5">
            Requested vs dispatched feet per job
          </p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end rounded-xl border border-line bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Status</label>
          <select
            name="status"
            defaultValue={effectiveStatus}
            className="field-input w-auto"
          >
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="all">All</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">From</label>
          <input
            type="date"
            name="date_from"
            defaultValue={date_from ?? ""}
            className="field-input w-auto"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">To</label>
          <input
            type="date"
            name="date_to"
            defaultValue={date_to ?? ""}
            className="field-input w-auto"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
        >
          Filter
        </button>
        {(date_from || date_to || (status && status !== "completed")) && (
          <Link
            href="/inventory/reports/overage"
            className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Jobs</p>
          <p className="text-2xl font-semibold text-ink">{withRequested.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Over</p>
          <p className="text-2xl font-semibold text-danger">{totalOver}</p>
        </div>
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Under</p>
          <p className="text-2xl font-semibold text-brand">{totalUnder}</p>
        </div>
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Avg Variance</p>
          <p className={`text-2xl font-semibold ${varianceColor(avgVariancePct)}`}>
            {avgVariancePct > 0 ? "+" : ""}
            {avgVariancePct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-line bg-white overflow-x-auto">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-4">
            No jobs match the filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-hover">
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Job #</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-ink-2">Completion</th>
                <th className="text-right px-4 py-3 font-semibold text-ink-2">Requested</th>
                <th className="text-right px-4 py-3 font-semibold text-ink-2">Dispatched</th>
                <th className="text-right px-4 py-3 font-semibold text-ink-2">Variance (ft)</th>
                <th className="text-right px-4 py-3 font-semibold text-ink-2">Variance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ job, requested, dispatched, variance, variancePct }) => {
                const color = requested > 0 ? varianceColor(variancePct) : "text-ink-4";
                return (
                  <tr key={job.id} className="hover:bg-hover">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/inventory/jobs/${job.id}`}
                        className="text-ink hover:underline"
                      >
                        {job.job_number ?? job.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{job.job_name}</td>
                    <td className="px-4 py-3 text-xs text-ink-3 whitespace-nowrap">
                      {job.completion_date
                        ? format(parseISO(job.completion_date), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2">
                      {Math.round(requested).toLocaleString()} ft
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2">
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
