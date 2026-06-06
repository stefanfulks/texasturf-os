import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaskBoard } from "@/components/tasks/task-board";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tasksRes, profilesRes, jobsRes, assigneesRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true }),
    // "Jobs" table is still public.projects under the hood. The UI surfaces
    // it as Jobs everywhere; the underlying schema rename will come later.
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("archived", false)
      .order("name", { ascending: true }),
    // task_assignees holds the multi-tag set. Not yet in generated types —
    // cast through unknown.
    (supabase.from("task_assignees") as unknown as {
      select: (cols: string) => Promise<{ data: Array<{ task_id: string; profile_id: string; is_primary: boolean }> | null; error: { message: string } | null }>;
    }).select("task_id, profile_id, is_primary"),
  ]);

  // Build task_id → string[] of profile ids tagged on that task.
  const assigneeMap: Record<string, string[]> = {};
  for (const row of assigneesRes.data ?? []) {
    if (!assigneeMap[row.task_id]) assigneeMap[row.task_id] = [];
    // Keep primary first.
    if (row.is_primary) assigneeMap[row.task_id].unshift(row.profile_id);
    else assigneeMap[row.task_id].push(row.profile_id);
  }

  return (
    <TaskBoard
      initialTasks={tasksRes.data ?? []}
      currentUserId={user.id}
      profiles={profilesRes.data ?? []}
      projects={jobsRes.data ?? []}
      assigneeMap={assigneeMap}
    />
  );
}
