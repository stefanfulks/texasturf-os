import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus, ProjectType, TaskPriority } from "@/lib/database.types";

export const metadata = { title: "Jobs · TexasTurf OS" };

const STATUS_LABEL: Record<ProjectStatus, string> = {
  intake: "Intake", planning: "Planning", waiting_customer: "Waiting (Customer)",
  waiting_internal: "Waiting (Internal)", scheduled: "Scheduled", in_progress: "In Progress",
  blocked: "Blocked", ready_for_review: "Ready for Review", complete: "Complete",
  on_hold: "On Hold", cancelled: "Cancelled",
};
const STATUS_COLOR: Record<ProjectStatus, string> = {
  intake: "bg-zinc-100 text-zinc-600", planning: "bg-blue-50 text-blue-600",
  waiting_customer: "bg-amber-50 text-amber-700", waiting_internal: "bg-yellow-50 text-yellow-700",
  scheduled: "bg-indigo-50 text-indigo-700", in_progress: "bg-blue-100 text-blue-800",
  blocked: "bg-red-100 text-red-700", ready_for_review: "bg-purple-50 text-purple-700",
  complete: "bg-green-100 text-green-700", on_hold: "bg-zinc-100 text-zinc-500",
  cancelled: "bg-zinc-50 text-zinc-400",
};
const TYPE_LABEL: Record<ProjectType, string> = {
  customer_install: "Install", commercial_bid: "Commercial Bid", sales_marketing: "Sales/Marketing",
  operations: "Operations", warehouse: "Warehouse", admin: "Admin",
  strategic: "Strategic", warranty: "Warranty", technology: "Technology",
};
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "bg-zinc-100 text-zinc-500", normal: "bg-blue-50 text-blue-600",
  high: "bg-amber-50 text-amber-700", urgent: "bg-red-50 text-red-700",
};

export default async function JobsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jobs } = await supabase
    .from("projects")
    .select("*, owner:owner_id(full_name, email), task_count:tasks(count)")
    .eq("archived", false)
    .order("created_at", { ascending: false });

  const active   = (jobs ?? []).filter((p) => !["complete","cancelled","on_hold"].includes(p.status));
  const inactive = (jobs ?? []).filter((p) =>  ["complete","cancelled","on_hold"].includes(p.status));

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-6 pb-32 sm:pb-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">Jobs</h1>
          <p className="text-sm sm:text-base text-zinc-600 mt-1">
            Customer installs, commercial bids, and internal work — synced with Jobber.
          </p>
          <p className="text-xs text-zinc-500 mt-1">{active.length} active</p>
        </div>
        <Link
          href="/jobs/new"
          className="hidden sm:inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 active:bg-zinc-700"
        >
          <Plus className="h-4 w-4" />
          New Job
        </Link>
      </div>

      {jobs?.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-base font-semibold text-zinc-900">No jobs yet</p>
          <p className="text-sm text-zinc-500 mt-1">Create your first job to start tracking customer work.</p>
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-1.5 mt-4 h-11 px-5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 active:bg-zinc-700"
          >
            <Plus className="h-4 w-4" />
            New Job
          </Link>
        </div>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">Active</h2>
          <div className="space-y-2">
            {active.map((job) => <JobRow key={job.id} job={job} />)}
          </div>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">Completed / On Hold</h2>
          <div className="space-y-2">
            {inactive.map((job) => <JobRow key={job.id} job={job} />)}
          </div>
        </section>
      )}

      {/* Mobile FAB */}
      <Link
        href="/jobs/new"
        className="sm:hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 inline-flex items-center gap-2 h-14 px-5 rounded-full bg-zinc-900 text-white text-sm font-semibold shadow-lg active:bg-zinc-700"
      >
        <Plus className="h-5 w-5" />
        New Job
      </Link>
    </div>
  );
}

function JobRow({ job }: { job: Record<string, unknown> }) {
  const status   = job.status   as ProjectStatus;
  const type     = job.type     as ProjectType;
  const priority = job.priority as TaskPriority;
  const owner    = job.owner    as { full_name: string | null; email: string } | null;
  const taskCount = Array.isArray(job.task_count) ? (job.task_count[0] as { count: number })?.count ?? 0 : 0;
  const dueDate   = job.due_date as string | null;
  const jobberUrl = job.jobber_url as string | null;

  return (
    <Link
      href={`/jobs/${job.id as string}`}
      className="block rounded-2xl border border-zinc-200 bg-white p-4 sm:px-5 sm:py-4 hover:border-zinc-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-zinc-900 group-hover:underline">
              {job.name as string}
            </span>
            {jobberUrl && (
              <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5">
                <ExternalLink className="h-2.5 w-2.5" />
                Jobber
              </span>
            )}
          </div>
          {(job.customer_name as string | null) && (
            <p className="text-sm text-zinc-600 mt-0.5 truncate">{job.customer_name as string}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-medium">
              {TYPE_LABEL[type]}
            </span>
            {owner && (
              <span className="text-xs text-zinc-500">
                {owner.full_name ?? owner.email.split("@")[0]}
              </span>
            )}
            {taskCount > 0 && (
              <span className="text-xs text-zinc-400">
                · {taskCount} task{taskCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
          {dueDate && (
            <span className="text-xs text-zinc-500 tabular-nums">
              {new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {priority !== "normal" && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[priority]}`}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </span>
          )}
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>
    </Link>
  );
}
