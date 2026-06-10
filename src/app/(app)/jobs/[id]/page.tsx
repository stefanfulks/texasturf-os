import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ExternalLink, MapPin, Calendar, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JobForm } from "../job-form";
import { JobArchiveButton } from "./archive-button";
import type { Project, Task, TaskStatus, TaskPriority, ProjectStatus } from "@/lib/db-helpers.types";

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
const TASK_STATUS_GROUPS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: "in_progress", label: "In Progress", dot: "bg-blue-500"   },
  { status: "inbox",       label: "Inbox",       dot: "bg-zinc-400"   },
  { status: "waiting",     label: "Waiting",     dot: "bg-purple-500" },
  { status: "blocked",     label: "Blocked",     dot: "bg-red-500"    },
  { status: "done",        label: "Done",        dot: "bg-green-500"  },
];
const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: "bg-zinc-100 text-zinc-500", normal: "bg-blue-50 text-blue-600",
  high: "bg-amber-50 text-amber-700", urgent: "bg-red-50 text-red-700",
};

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [jobRes, tasksRes, profileRes] = await Promise.all([
    supabase.from("projects").select("*, owner:owner_id(id, full_name, email), created_by:created_by_id(id, full_name, email)").eq("id", id).single(),
    supabase.from("tasks").select("*, assignee:assignee_id(id, full_name, email)").eq("project_id", id).neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  const isOfficeOrAdmin = ["admin", "office"].includes((profileRes.data as { role?: string } | null)?.role ?? "");

  if (!jobRes.data) notFound();

  const job = jobRes.data as unknown as Project & {
    owner: { id: string; full_name: string | null; email: string } | null;
    created_by: { id: string; full_name: string | null; email: string } | null;
  };
  const tasks = (tasksRes.data ?? []) as unknown as Array<Task & {
    assignee: { id: string; full_name: string | null; email: string } | null;
  }>;

  const openTasks = tasks.filter((t) => t.status !== "done");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6 space-y-5 pb-12">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-zinc-500 hover:text-zinc-900 active:text-zinc-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 break-words">{job.name}</h1>
          {job.customer_name && (
            <p className="text-base text-zinc-600 mt-1 flex items-center gap-1.5">
              <User className="h-4 w-4 text-zinc-400" />
              {job.customer_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {job.archived && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500">Archived</span>
          )}
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[job.status]}`}>
            {STATUS_LABEL[job.status]}
          </span>
          {isOfficeOrAdmin && (
            <JobArchiveButton jobId={job.id} archived={job.archived ?? false} />
          )}
        </div>
      </div>

      {/* Jobber panel — prominent at the top so anyone can jump straight into Jobber for this job. */}
      <JobberPanel jobId={job.id} jobberUrl={job.jobber_url ?? null} customerName={job.customer_name ?? null} />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Open Tasks",    value: openTasks.length,    color: openTasks.length > 0 ? "text-zinc-900" : "text-zinc-400" },
          { label: "Blocked",       value: blockedTasks.length, color: blockedTasks.length > 0 ? "text-red-600" : "text-zinc-400" },
          { label: "Total Tasks",   value: tasks.length,        color: "text-zinc-900" },
          { label: "Due",           value: job.due_date ? format(parseISO(job.due_date), "MMM d") : "—", color: "text-zinc-900" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">{stat.label}</p>
            <p className={`text-xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tasks by status */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Tasks</h2>
          <Link href={`/tasks?project=${id}`} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
            View in board →
          </Link>
        </div>

        {tasks.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">
            No tasks yet. Create a task and link it to this job.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {TASK_STATUS_GROUPS.map((group) => {
              const groupTasks = tasks.filter((t) => t.status === group.status);
              if (groupTasks.length === 0) return null;
              return (
                <div key={group.status}>
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-zinc-50">
                    <span className={`w-2 h-2 rounded-full ${group.dot}`} />
                    <span className="text-xs font-semibold text-zinc-700">{group.label}</span>
                    <span className="text-xs text-zinc-400">{groupTasks.length}</span>
                  </div>
                  <div className="divide-y divide-zinc-50">
                    {groupTasks.map((task) => (
                      <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 group">
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${task.status === "done" ? "line-through text-zinc-400" : "text-zinc-900"} group-hover:underline`}>{task.title}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                          {task.assignee && (
                            <span className="text-zinc-500">{task.assignee.full_name ?? task.assignee.email.split("@")[0]}</span>
                          )}
                          {task.priority !== "normal" && (
                            <span className={`px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[task.priority]}`}>
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-zinc-400 tabular-nums">{format(parseISO(task.due_date), "MMM d")}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit form */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-5">Job Settings</h2>
        <JobForm mode="edit" job={job} />
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Info</h3>
        {job.address && (
          <div className="flex gap-2 items-start">
            <MapPin className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
            <span className="text-zinc-700">{job.address}</span>
          </div>
        )}
        {job.target_install_date && (
          <div className="flex gap-2 items-center">
            <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="text-zinc-700">Install: {format(parseISO(job.target_install_date), "MMMM d, yyyy")}</span>
          </div>
        )}
        {job.owner && (
          <div className="flex gap-2 items-center">
            <User className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="text-zinc-700">Owner: {job.owner.full_name ?? job.owner.email}</span>
          </div>
        )}
        <div className="flex gap-2 items-center text-zinc-500">
          <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
          <span>Created {format(parseISO(job.created_at), "MMM d, yyyy")}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Jobber integration panel ─────────────────────────────────────────────────
//
// When a jobber_url is set, show a big clear "Open in Jobber" card so anyone
// looking at this job can jump to the work order, scheduling, or invoice
// without hunting through the form below.

function JobberPanel({
  jobId,
  jobberUrl,
  customerName,
}: {
  jobId: string;
  jobberUrl: string | null;
  customerName: string | null;
}) {
  if (jobberUrl) {
    return (
      <a
        href={jobberUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5 hover:border-blue-400 hover:shadow-sm transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            J
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-blue-900">Open in Jobber</p>
              <ExternalLink className="h-3.5 w-3.5 text-blue-700 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-blue-700/80 truncate">
              {customerName ? `${customerName} · ` : ""}{jobberUrl.replace(/^https?:\/\//, "")}
            </p>
          </div>
        </div>
      </a>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-zinc-200 text-zinc-500 flex items-center justify-center font-bold text-lg">
          J
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-700">No Jobber link yet</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Paste the Jobber work-order URL in <a href={`#jobber-input-${jobId}`} className="underline">Job Settings</a> below so the crew can jump straight to it.
          </p>
        </div>
      </div>
    </div>
  );
}
