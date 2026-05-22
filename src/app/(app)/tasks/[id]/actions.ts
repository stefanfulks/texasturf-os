"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ─── Update Task ──────────────────────────────────────────────────────────────

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["inbox", "in_progress", "waiting", "blocked", "done", "archived"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  due_date: z.string().optional(),
  blocked_reason: z.string().optional(),
});

export type UpdateTaskState = { error: string | null; success: boolean };

export async function updateTask(
  _prev: UpdateTaskState,
  formData: FormData,
): Promise<UpdateTaskState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const raw = {
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    status: formData.get("status"),
    priority: formData.get("priority"),
    due_date: formData.get("due_date") ?? undefined,
    blocked_reason: formData.get("blocked_reason") ?? undefined,
  };

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { id, ...fields } = parsed.data;

  // Fetch current state for activity log
  const { data: existing } = await supabase
    .from("tasks")
    .select("status, priority, due_date")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("tasks")
    .update({
      title: fields.title,
      description: fields.description || null,
      status: fields.status,
      priority: fields.priority,
      due_date: fields.due_date || null,
      blocked_reason: fields.status === "blocked" ? (fields.blocked_reason || null) : null,
      completed_at: fields.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { error: error.message, success: false };

  // Log activity entries
  const events = [];
  if (existing?.status !== fields.status) {
    events.push({ task_id: id, actor_id: user.id, event_type: "status_changed", old_value: existing?.status, new_value: fields.status });
  }
  if (existing?.priority !== fields.priority) {
    events.push({ task_id: id, actor_id: user.id, event_type: "priority_changed", old_value: existing?.priority, new_value: fields.priority });
  }
  if (existing?.due_date !== fields.due_date) {
    events.push({ task_id: id, actor_id: user.id, event_type: "due_date_changed", old_value: existing?.due_date, new_value: fields.due_date || null });
  }
  if (events.length > 0) {
    await supabase.from("task_activity").insert(events);
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`, "page");
  return { error: null, success: true };
}

// ─── Add Comment ──────────────────────────────────────────────────────────────

const commentSchema = z.object({
  task_id: z.string().uuid(),
  body: z.string().min(1, "Comment cannot be empty"),
});

export type AddCommentState = { error: string | null; success: boolean };

export async function addComment(
  _prev: AddCommentState,
  formData: FormData,
): Promise<AddCommentState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = commentSchema.safeParse({
    task_id: formData.get("task_id"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase.from("task_comments").insert({
    task_id: parsed.data.task_id,
    user_id: user.id,
    body: parsed.data.body,
  });

  if (error) return { error: error.message, success: false };

  await supabase.from("task_activity").insert({
    task_id: parsed.data.task_id,
    actor_id: user.id,
    event_type: "commented",
    new_value: parsed.data.body.slice(0, 100),
  });

  // Notify the task's assignee (if different from commenter)
  const { data: task } = await supabase
    .from("tasks")
    .select("assignee_id, title")
    .eq("id", parsed.data.task_id)
    .single();

  if (task && task.assignee_id !== user.id) {
    const { data: actor } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    const actorName = actor?.full_name ?? actor?.email?.split("@")[0] ?? "Someone";
    await supabase.from("notifications").insert({
      user_id: task.assignee_id,
      actor_id: user.id,
      type: "task_commented",
      title: `${actorName} commented on "${task.title}"`,
      body: parsed.data.body.slice(0, 120),
      resource_type: "task",
      resource_id: parsed.data.task_id,
    });
  }

  revalidatePath(`/tasks/${parsed.data.task_id}`, "page");
  return { error: null, success: true };
}
