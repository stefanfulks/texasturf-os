import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO, isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { TaskEditForm } from "./task-edit-form";
import { CommentSection } from "./comment-section";
import type { Task, TaskPriority, TaskStatus } from "@/lib/database.types";

const STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Inbox", in_progress: "In Progress", waiting: "Waiting",
  blocked: "Blocked", done: "Done", archived: "Archived",
};
const STATUS_COLORS: Record<TaskStatus, string> = {
  inbox: "bg-zinc-100 text-zinc-600",
  in_progress: "bg-blue-100 text-blue-700",
  waiting: "bg-purple-100 text-purple-700",
  blocked: "bg-red-100 text-red-700",
  done: "bg-green-100 text-green-700",
  archived: "bg-zinc-100 text-zinc-400",
};
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-zinc-100 text-zinc-500",
  normal: "bg-blue-50 text-blue-600",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [taskRes, commentsRes, activityRes] = await Promise.all([
    supabase.from("tasks").select("*, assignee:assignee_id(id, full_name, email), created_by:created_by_id(id, full_name, email)").eq("id", id).single(),
    supabase.from("task_comments").select("*, author:user_id(id, full_name, email)").eq("task_id", id).order("created_at", { ascending: true }),
    supabase.from("task_activity").select("*, actor:actor_id(id, full_name, email)").eq("task_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

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
      <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
        ← My Tasks
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
          {STATUS_LABELS[task.status]}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
        {isOverdue && (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
            Overdue
          </span>
        )}
      </div>

      {/* Edit form */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <TaskEditForm task={task} />
      </div>

      {/* Meta */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-2 text-sm text-zinc-600">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Details</h3>
        {task.assignee && (
          <div className="flex gap-2">
            <span className="text-zinc-400 w-24 flex-shrink-0">Assignee</span>
            <span>{task.assignee.full_name ?? task.assignee.email}</span>
          </div>
        )}
        {task.created_by && (
          <div className="flex gap-2">
            <span className="text-zinc-400 w-24 flex-shrink-0">Created by</span>
            <span>{task.created_by.full_name ?? task.created_by.email}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="text-zinc-400 w-24 flex-shrink-0">Created</span>
          <span>{format(parseISO(task.created_at), "MMM d, yyyy")}</span>
        </div>
        {task.completed_at && (
          <div className="flex gap-2">
            <span className="text-zinc-400 w-24 flex-shrink-0">Completed</span>
            <span>{format(parseISO(task.completed_at), "MMM d, yyyy")}</span>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="rounded-xl border border-zinc-200 bg-white">
        <CommentSection
          taskId={id}
          currentUserId={user?.id ?? ""}
          comments={(commentsRes.data ?? []) as Array<{
            id: string;
            body: string;
            created_at: string;
            author: { full_name: string | null; email: string } | null;
          }>}
        />
      </div>

      {/* Activity */}
      {activityRes.data && activityRes.data.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Activity</h3>
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
                <div key={event.id} className="flex items-baseline gap-2 text-sm text-zinc-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 flex-shrink-0 mt-1.5" />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-zinc-400 flex-shrink-0">{format(parseISO(event.created_at), "MMM d")}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
