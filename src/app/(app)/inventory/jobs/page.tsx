import Link from "next/link";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { JobStatusBadge } from "@/components/inventory/job-status-badge";
import type { InvJob, InvAllocation } from "@/lib/db-helpers.types";

const STATUS_FILTERS = [
  { label: "All Active",  value: "all"          },
  { label: "Planning",    value: "planning"     },
  { label: "In Progress", value: "in_progress"  },
  { label: "Staged",      value: "staged"       },
  { label: "Completed",   value: "completed"    },
] as const;

export default async function InventoryJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const supabase = await createClient();

  // Fetch all non-archived jobs sorted by scheduled_date asc nulls last, then created_at desc.
  // Supabase's order() supports nullsFirst:false to push nulls last.
  let query = supabase
    .from("inv_jobs")
    .select("*")
    .neq("status", "archived")
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: jobsRaw } = await query;
  const jobs = (jobsRaw ?? []) as InvJob[];

  // Single query for all allocations belonging to these jobs (for counts).
  const jobIds = jobs.map((j) => j.id);
  const allocCountByJob = new Map<string, number>();
  if (jobIds.length > 0) {
    const { data: allocs } = await supabase
      .from("inv_allocations")
      .select("id, job_id")
      .in("job_id", jobIds);
    for (const a of (allocs ?? []) as Pick<InvAllocation, "id" | "job_id">[]) {
      allocCountByJob.set(a.job_id, (allocCountByJob.get(a.job_id) ?? 0) + 1);
    }
  }

  // Client-side text filter on job_number or job_name.
  const filtered = q
    ? jobs.filter((j) => {
        const hay = `${j.job_number ?? ""} ${j.job_name}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : jobs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            {filtered.length} job{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/inventory/jobs/archived"
            className="flex items-center gap-2 rounded-xl border border-line-strong bg-white px-4 py-2.5 text-sm font-semibold text-ink-2 hover:border-line-strong hover:text-ink transition-colors"
          >
            View Archived
          </Link>
          <Link
            href="/inventory/jobs/new"
            className="btn btn-primary"
          >
            <span className="text-lg leading-none">+</span> New Job
          </Link>
        </div>
      </div>

      {/* Filter + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const active = (status ?? "all") === f.value;
            const href =
              f.value === "all"
                ? "/inventory/jobs" + (q ? `?q=${encodeURIComponent(q)}` : "")
                : `/inventory/jobs?status=${f.value}` + (q ? `&q=${encodeURIComponent(q)}` : "");
            return (
              <Link
                key={f.value}
                href={href}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-brand text-white border-ink"
                    : "bg-white text-ink-2 border-line hover:border-line-strong"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        <form method="GET" className="flex-1 max-w-sm">
          {status && status !== "all" && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search job # or name…"
            className="w-full text-sm border border-line rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white"
          />
        </form>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-4">No jobs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover">
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Job #</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Job Name</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Site Address</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Scheduled</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Allocations</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-line hover:bg-hover/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      <Link href={`/inventory/jobs/${job.id}`} className="hover:underline">
                        {job.job_number ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      <Link href={`/inventory/jobs/${job.id}`} className="hover:underline">
                        {job.job_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-3 truncate max-w-[260px]">
                      {job.site_address ?? <span className="text-ink-4">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-3">
                      {job.scheduled_date ? format(parseISO(job.scheduled_date), "MMM d, yyyy") : <span className="text-ink-4">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2 font-medium">
                      {allocCountByJob.get(job.id) ?? 0}
                    </td>
                    <td className="px-4 py-3 text-ink-4 text-xs">
                      {format(parseISO(job.created_at), "MMM d")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
