import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "../project-form";
import type { Project, Task, TaskStatus, TaskPriority, ProjectStatus } from "@/lib/database.types";

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

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [projectRes, tasksRes] = await Promise.all([
    supabase.from("projects").select("*, owner:owner_id(id, full_name, email), created_by:created_by_id(id, full_name, email)").eq("id", id).single(),
    supabase.from("tasks").select("*, assignee:assignee_id(id, full_name, email)").eq("project_id", id).neq("status", "archived").order("created_at", { ascending: false }),
  ]);

  if (!projectRes.data) notFound();

  const project = projectRes.data as unknown as Project & {
    owner: { id: string; full_name: string | null; email: string } | null;
    created_by: { id: string; full_name: string | null; email: string } | null;
  };
  const tasks = (tasksRes.data ?? []) as unknown as Array<Task & {
    assignee: { id: string; full_name: string | null; email: string } | null;
  }>;

  const openTasks = tasks.filter((t) => t.status !== "done");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">← Projects</Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          {project.customer_name && <p className="text-sm text-zinc-500 mt-0.5">{project.customer_name}</p>}
        </div>
        <span className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[project.status]}`}>
          {STATUS_LABEL[project.status]}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Open Tasks",    value: openTasks.length,    color: openTasks.length > 0 ? "text-zinc-900" : "text-zinc-400" },
          { label: "Blocked",       value: blockedTasks.length, color: blockedTasks.length > 0 ? "text-red-600 font-semibold" : "text-zinc-400" },
          { label: "Total Tasks",   value: tasks.length,        color: "text-zinc-900" },
          { label: "Due",           value: project.due_date ? format(parseISO(project.due_date), "MMM d") : "—", color: "text-zinc-900" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <p className="text-xs text-zinc-400 mb-1">{stat.label}</p>
            <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tasks by status */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold">Tasks</h2>
          <Link href={`/tasks?project=${id}`} className="text-xs text-zinc-500 hover:text-zinc-900">
            View in board →
          </Link>
        </div>

        {tasks.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">
            No tasks yet. Create a task and link it to this project.
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
                    <span className="text-xs font-semibold text-zinc-600">{group.label}</span>
                    <span className="text-xs text-zinc-400">{groupTasks.length}</span>
                  </div>
                  <div className="divide-y divide-zinc-50">
                    {groupTasks.map((task) => (
                      <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50 group">
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${task.status === "done" ? "line-through text-zinc-400" : "text-zinc-900"} group-hover:underline`}>{task.title}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                          {task.assignee && (
                            <span className="text-zinc-400">{task.assignee.full_name ?? task.assignee.email.split("@")[0]}</span>
                          )}
                          {task.priority !== "normal" && (
                            <span className={`px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[task.priority]}`}>
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-zinc-400">{format(parseISO(task.due_date), "MMM d")}</span>
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
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold mb-5">Project Settings</h2>
        <ProjectForm mode="edit" project={project} />
      </div>

      {/* Details */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Info</h3>
        {project.address && <div className="flex gap-2"><span className="text-zinc-400 w-28 flex-shrink-0">Address</span><span>{project.address}</span></div>}
        {project.target_install_date && <div className="flex gap-2"><span className="text-zinc-400 w-28 flex-shrink-0">Install Date</span><span>{format(parseISO(project.target_install_date), "MMMM d, yyyy")}</span></div>}
        {project.jobber_url && <div className="flex gap-2"><span className="text-zinc-400 w-28 flex-shrink-0">Jobber</span><a href={project.jobber_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{project.jobber_url}</a></div>}
        {project.owner && <div className="flex gap-2"><span className="text-zinc-400 w-28 flex-shrink-0">Owner</span><span>{project.owner.full_name ?? project.owner.email}</span></div>}
        <div className="flex gap-2"><span className="text-zinc-400 w-28 flex-shrink-0">Created</span><span>{format(parseISO(project.created_at), "MMM d, yyyy")}</span></div>
      </div>
    </div>
  );
}
