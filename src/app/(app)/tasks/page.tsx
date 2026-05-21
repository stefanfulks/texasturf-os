import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaskBoard } from "@/components/tasks/task-board";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("assignee_id", user.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return <TaskBoard initialTasks={tasks ?? []} />;
}
