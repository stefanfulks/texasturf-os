"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Task, TaskStatus } from "@/lib/database.types";

// ─── Create Task ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z.enum(["inbox", "in_progress", "waiting", "blocked", "done"]).default("inbox"),
  due_date: z.string().optional(),
  blocked_reason: z.string().optional(),
});

export type CreateTaskResult = {
  task: Task | null;
  error: string | null;
};

export async function createTask(formData: FormData): Promise<CreateTaskResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { task: null, error: "Not authenticated" };

  const raw = {
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    priority: formData.get("priority") ?? "normal",
    status: formData.get("status") ?? "inbox",
    due_date: formData.get("due_date") ?? undefined,
    blocked_reason: formData.get("blocked_reason") ?? undefined,
  };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { task: null, error: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  const assigneeIdRaw = formData.get("assignee_id");
  const projectIdRaw  = formData.get("project_id");
  const assigneeId = (typeof assigneeIdRaw === "string" && assigneeIdRaw) ? assigneeIdRaw : user.id;
  const projectId  = (typeof projectIdRaw  === "string" && projectIdRaw)  ? projectIdRaw  : null;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      status: parsed.data.status,
      due_date: parsed.data.due_date || null,
      blocked_reason: parsed.data.blocked_reason || null,
      assignee_id: assigneeId,
      created_by_id: user.id,
      project_id: projectId,
    })
    .select()
    .single();

  if (error) return { task: null, error: error.message };

  // Log activity
  await supabase.from("task_activity").insert({
    task_id: data.id,
    actor_id: user.id,
    event_type: "created",
    new_value: parsed.data.title,
  });

  // Notify assignee if someone else was assigned
  if (assigneeId !== user.id) {
    const { data: actor } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    const actorName = actor?.full_name ?? actor?.email?.split("@")[0] ?? "Someone";
    await supabase.from("notifications").insert({
      user_id: assigneeId,
      actor_id: user.id,
      type: "task_assigned",
      title: `${actorName} assigned you a task`,
      body: parsed.data.title,
      resource_type: "task",
      resource_id: data.id,
    });
  }

  revalidatePath("/tasks");
  return { task: data, error: null };
}

// ─── Update Task Status ────────────────────────────────────────────────────────

export type UpdateStatusResult = { error: string | null };

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  blockedReason?: string,
): Promise<UpdateStatusResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: existing } = await supabase
    .from("tasks")
    .select("status")
    .eq("id", taskId)
    .single();

  const { error } = await supabase
    .from("tasks")
    .update({
      status: newStatus,
      blocked_reason: newStatus === "blocked" ? (blockedReason || null) : null,
      completed_at: newStatus === "done" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) return { error: error.message };

  // Log activity
  await supabase.from("task_activity").insert({
    task_id: taskId,
    actor_id: user.id,
    event_type: "status_changed",
    old_value: existing?.status ?? null,
    new_value: newStatus,
  });

  revalidatePath("/tasks");
  return { error: null };
}

// ─── Complete Task (quick action) ─────────────────────────────────────────────

export async function completeTask(taskId: string): Promise<UpdateStatusResult> {
  return updateTaskStatus(taskId, "done");
}

// ─── Delete Task ──────────────────────────────────────────────────────────────

export async function deleteTask(taskId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { error: null };
}
