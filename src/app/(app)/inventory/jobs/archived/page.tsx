import Link from "next/link";
import { format, parseISO } from "date-fns";
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
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Jobs
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Archived Jobs</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {jobs.length} archived job{jobs.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {jobs.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">No archived jobs.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Job #</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Job Name</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Site Address</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Archived</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const restoreAction = restoreJob.bind(null, job.id);
                  return (
                    <tr key={job.id} className="border-b border-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link href={`/inventory/jobs/${job.id}`} className="hover:underline">
                          {job.job_number ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        <Link href={`/inventory/jobs/${job.id}`} className="hover:underline">
                          {job.job_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 truncate max-w-[260px]">
                        {job.site_address ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {format(parseISO(job.updated_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/inventory/jobs/${job.id}`}
                            className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                          >
                            View
                          </Link>
                          <form action={restoreAction}>
                            <button
                              type="submit"
                              className="text-xs px-2.5 py-1 rounded-md border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
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
