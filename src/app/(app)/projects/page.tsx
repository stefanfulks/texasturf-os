import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus, ProjectType, TaskPriority } from "@/lib/database.types";

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

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*, owner:owner_id(full_name, email), task_count:tasks(count)")
    .eq("archived", false)
    .order("created_at", { ascending: false });

  const active   = (projects ?? []).filter((p) => !["complete","cancelled","on_hold"].includes(p.status));
  const inactive = (projects ?? []).filter((p) =>  ["complete","cancelled","on_hold"].includes(p.status));

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{active.length} active</p>
        </div>
        <Link href="/projects/new" className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
          + New Project
        </Link>
      </div>

      {projects?.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-400">
          No projects yet.{" "}
          <Link href="/projects/new" className="text-zinc-700 underline">Create your first one.</Link>
        </div>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Active</h2>
          <div className="space-y-2">
            {active.map((p) => <ProjectRow key={p.id} project={p} />)}
          </div>
        </section>
      )}

      {inactive.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Completed / On Hold</h2>
          <div className="space-y-2">
            {inactive.map((p) => <ProjectRow key={p.id} project={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectRow({ project }: { project: Record<string, unknown> }) {
  const status   = project.status   as ProjectStatus;
  const type     = project.type     as ProjectType;
  const priority = project.priority as TaskPriority;
  const owner    = project.owner    as { full_name: string | null; email: string } | null;
  // task_count is returned as [{ count: number }] by Supabase aggregate
  const taskCount = Array.isArray(project.task_count) ? (project.task_count[0] as { count: number })?.count ?? 0 : 0;
  const dueDate   = project.due_date as string | null;

  return (
    <Link href={`/projects/${project.id as string}`} className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-zinc-200 bg-white hover:shadow-sm transition-shadow group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-zinc-900 truncate group-hover:underline">{project.name as string}</span>
          {(project.customer_name as string | null) && (
            <span className="text-xs text-zinc-400 truncate">· {project.customer_name as string}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">{TYPE_LABEL[type]}</span>
          {owner && <span className="text-xs text-zinc-400">{owner.full_name ?? owner.email.split("@")[0]}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 text-xs">
        {taskCount > 0 && <span className="text-zinc-400">{taskCount} task{taskCount !== 1 ? "s" : ""}</span>}
        {dueDate && <span className="text-zinc-400">{new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
        {priority !== "normal" && <span className={`px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLOR[priority]}`}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>}
        <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
      </div>
    </Link>
  );
}
