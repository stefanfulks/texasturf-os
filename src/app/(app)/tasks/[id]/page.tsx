import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO, isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { TaskEditForm } from "./task-edit-form";
import { TaskArchiveButton } from "./archive-button";
import { CommentSection } from "./comment-section";
import { SubtasksSection } from "./subtasks-section";
import type { Task, TaskPriority, TaskStatus } from "@/lib/db-helpers.types";

const STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Inbox", in_progress: "In Progress", waiting: "Waiting",
  blocked: "Blocked", done: "Done", archived: "Archived",
};
const STATUS_COLORS: Record<TaskStatus, string> = {
  inbox: "bg-sunken text-ink-2",
  in_progress: "bg-info-tint text-info",
  waiting: "bg-info-tint text-info",
  blocked: "bg-danger-tint text-danger",
  done: "bg-brand-tint text-brand",
  archived: "bg-sunken text-ink-4",
};
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-sunken text-ink-3",
  normal: "bg-info-tint text-info",
  high: "bg-warn-tint text-warn",
  urgent: "bg-danger-tint text-danger",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [taskRes, commentsRes, activityRes, profileRes, allProfilesRes, subtasksRes, assigneesRes] = await Promise.all([
    supabase.from("tasks").select("*, assignee:assignee_id(id, full_name, email), created_by:created_by_id(id, full_name, email)").eq("id", id).single(),
    supabase.from("task_comments").select("*, author:user_id(id, full_name, email)").eq("task_id", id).order("created_at", { ascending: true }),
    supabase.from("task_activity").select("*, actor:actor_id(id, full_name, email)").eq("task_id", id).order("created_at", { ascending: false }).limit(20),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id, full_name, email").order("full_name", { ascending: true }),
    // Subtasks — fetched via the parent_task_id column added in migration 20260530200000.
    supabase
      .from("tasks")
      // Cast through unknown until generated types regenerate after the migration.
      .select("id, title, status, priority, due_date, assignee_id, parent_task_id" as never)
      .eq("parent_task_id" as never, id)
      .neq("status", "archived")
      .order("created_at", { ascending: true }),
    // Multi-assignee tags. Cast through unknown until generated types regenerate.
    (supabase.from("task_assignees") as unknown as {
      select: (cols: string) => { eq: (c: string, v: string) => Promise<{ data: Array<{ profile_id: string; is_primary: boolean }> | null }> };
    }).select("profile_id, is_primary").eq("task_id", id),
  ]);
  const isOfficeOrAdmin = ["admin", "office"].includes((profileRes.data as { role?: string } | null)?.role ?? "");
  const allProfiles = (allProfilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string }>;
  const subtasks = (subtasksRes.data ?? []) as unknown as Array<{
    id: string; title: string; status: TaskStatus; priority: TaskPriority; due_date: string | null; assignee_id: string;
  }>;
  // Assignee list — primary first, then everyone else.
  const taggedRows = (assigneesRes.data ?? []);
  const assigneeIds: string[] = [];
  for (const r of taggedRows) if (r.is_primary) assigneeIds.push(r.profile_id);
  for (const r of taggedRows) if (!r.is_primary) assigneeIds.push(r.profile_id);
  const profileById = new Map(allProfiles.map((p) => [p.id, p]));
  const taggedAssignees = assigneeIds.map((id) => profileById.get(id)).filter(Boolean) as Array<{ id: string; full_name: string | null; email: string }>;

  if (!taskRes.data) notFound();
  // The multi-FK join (assignee_id + created_by_id both → profiles) can't be
  // auto-inferred by Supabase TS types, so we cast through unknown.
  const task = taskRes.data as unknown as Task & {
    assignee: { id: string; full_name: string | null; email: string } | null;
    created_by: { id: string; full_name: string | null; email: string } | null;
  };

  const isOverdue = task.due_date && task.status !== "done" && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back */}
      <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        ← My Tasks
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
            {STATUS_LABELS[task.status]}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
          </span>
          {isOverdue && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-danger-tint text-danger">
              Overdue
            </span>
          )}
        </div>
        {isOfficeOrAdmin && (
          <TaskArchiveButton taskId={task.id} archived={task.status === "archived"} />
        )}
      </div>

      {/* Edit form */}
      <div className="rounded-xl border border-line bg-white p-6">
        <TaskEditForm
          task={task}
          allProfiles={allProfiles}
          initialAssigneeIds={assigneeIds.length > 0 ? assigneeIds : [task.assignee_id]}
        />
      </div>

      {/* Meta */}
      <div className="rounded-xl border border-line bg-white p-5 space-y-2 text-sm text-ink-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-3">Details</h3>
        {taggedAssignees.length > 0 && (
          <div className="flex gap-2">
            <span className="text-ink-4 w-24 flex-shrink-0 pt-0.5">Tagged</span>
            <span className="flex flex-wrap gap-1">
              {taggedAssignees.map((p, i) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-ink-2">
                  {p.full_name ?? p.email.split("@")[0]}
                  {i === 0 && <span className="text-[9px] uppercase tracking-wider text-ink-4">primary</span>}
                </span>
              ))}
            </span>
          </div>
        )}
        {task.created_by && (
          <div className="flex gap-2">
            <span className="text-ink-4 w-24 flex-shrink-0">Created by</span>
            <span>{task.created_by.full_name ?? task.created_by.email}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="text-ink-4 w-24 flex-shrink-0">Created</span>
          <span>{format(parseISO(task.created_at), "MMM d, yyyy")}</span>
        </div>
        {task.completed_at && (
          <div className="flex gap-2">
            <span className="text-ink-4 w-24 flex-shrink-0">Completed</span>
            <span>{format(parseISO(task.completed_at), "MMM d, yyyy")}</span>
          </div>
        )}
      </div>

      {/* Subtasks */}
      <SubtasksSection parentId={id} subtasks={subtasks} />

      {/* Comments */}
      <div className="rounded-xl border border-line bg-white">
        <CommentSection
          taskId={id}
          currentUserId={user?.id ?? ""}
          comments={(commentsRes.data ?? []) as Array<{
            id: string;
            body: string;
            created_at: string;
            author: { full_name: string | null; email: string } | null;
          }>}
          profiles={allProfiles}
        />
      </div>

      {/* Activity */}
      {activityRes.data && activityRes.data.length > 0 && (
        <div className="rounded-xl border border-line bg-white p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-4">Activity</h3>
          <div className="space-y-3">
            {(activityRes.data as unknown as Array<{ id: string; event_type: string; old_value: string | null; new_value: string | null; created_at: string; actor: { full_name: string | null; email: string } | null }>).map((event) => {
              const actor = event.actor;
              const name = actor?.full_name ?? actor?.email ?? "Someone";
              const label =
                event.event_type === "created" ? `${name} created this task` :
                event.event_type === "status_changed" ? `${name} changed status to ${STATUS_LABELS[event.new_value as TaskStatus] ?? event.new_value}` :
                event.event_type === "priority_changed" ? `${name} changed priority to ${event.new_value}` :
                event.event_type === "due_date_changed" ? `${name} changed due date to ${event.new_value ? format(parseISO(event.new_value), "MMM d") : "none"}` :
                event.event_type === "commented" ? `${name} added a comment` :
                `${name} ${event.event_type}`;
              return (
                <div key={event.id} className="flex items-baseline gap-2 text-sm text-ink-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-line-strong flex-shrink-0 mt-1.5" />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-ink-4 flex-shrink-0">{format(parseISO(event.created_at), "MMM d")}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
