import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Archive } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { restoreJob } from "../actions";
import type { InvJob } from "@/lib/db-helpers.types";

export default async function ArchivedJobsPage() {
  const supabase = await createClient();

  const { data: jobsRaw } = await supabase
    .from("inv_jobs")
    .select("*")
    .eq("status", "archived")
    .order("updated_at", { ascending: false });

  const jobs = (jobsRaw ?? []) as InvJob[];

  return (
    <div className="space-y-6">
      <Link
        href="/inventory/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        ← Jobs
      </Link>

      <div>
        <h1 className="page-title">Archived Jobs</h1>
        <p className="text-sm text-ink-3 mt-0.5">
          {jobs.length} archived job{jobs.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="card overflow-hidden">
        {jobs.length === 0 ? (
          <div className="empty-state">
            <span className="medallion"><Archive className="h-5 w-5" /></span>
            <p className="empty-state-title">No archived jobs</p>
            <p className="empty-state-body">Jobs you archive are kept here for reference and can be restored anytime.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover">
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Job #</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Job Name</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Site Address</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Archived</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const restoreAction = restoreJob.bind(null, job.id);
                  return (
                    <tr key={job.id} className="border-b border-line">
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
                      <td className="px-4 py-3 text-ink-4 text-xs">
                        {format(parseISO(job.updated_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/inventory/jobs/${job.id}`}
                            className="text-xs px-2.5 py-1 rounded-md border border-line bg-white text-ink-2 hover:border-line-strong"
                          >
                            View
                          </Link>
                          <form action={restoreAction}>
                            <button
                              type="submit"
                              className="text-xs px-2.5 py-1 rounded-md border border-line-strong bg-white text-ink-2 hover:border-line-strong"
                            >
                              Restore
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
