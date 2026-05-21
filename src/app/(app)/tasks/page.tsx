import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaskBoard } from "@/components/tasks/task-board";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tasksRes, profilesRes, projectsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true }),
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("archived", false)
      .order("name", { ascending: true }),
  ]);

  return (
    <TaskBoard
      initialTasks={tasksRes.data ?? []}
      currentUserId={user.id}
      profiles={profilesRes.data ?? []}
      projects={projectsRes.data ?? []}
    />
  );
}
