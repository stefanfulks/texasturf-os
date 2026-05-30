import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO, isToday, isPast } from "date-fns";
import { ListTodo, Calendar, Hammer, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SectionCard } from "@/components/section-card";

export const metadata = { title: "Field · TexasTurf OS" };

export default async function FieldPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const [myTasksRes, todayCountRes] = await Promise.all([
    supabase.from("tasks").select("id, title, status, priority, due_date")
      .eq("assignee_id", user.id)
      .not("status", "in", "(done,archived)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .eq("assignee_id", user.id)
      .not("status", "in", "(done,archived)")
      .eq("due_date", today),
  ]);

  const tasks = myTasksRes.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Field</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Installer view: your assigned work, schedule, and quick links.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          href="/tasks"
          title="My tasks"
          description="Tasks assigned to you across all projects."
          icon={<ListTodo className="h-5 w-5" />}
          badge={todayCountRes.count ?? null}
          accent={(todayCountRes.count ?? 0) > 0 ? "amber" : "neutral"}
        />
        <SectionCard
          href="/calendar"
          title="My schedule"
          description="Calendar — today, this week, next week."
          icon={<Calendar className="h-5 w-5" />}
          accent="blue"
        />
        <SectionCard
          href="/inventory/jobs"
          title="Active jobs"
          description="See what's in progress at the warehouse."
          icon={<Hammer className="h-5 w-5" />}
          accent="green"
        />
        <SectionCard
          href="/fleet"
          title="Fleet"
          description="Trucks, trailers, equipment — what's assigned today."
          icon={<MapPin className="h-5 w-5" />}
          accent="purple"
        />
      </div>

      {tasks.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
            <h2 className="text-sm font-semibold">My next work</h2>
            <Link href="/tasks" className="text-xs text-zinc-500 hover:text-zinc-900">
              All tasks →
            </Link>
          </div>
          <ul className="divide-y divide-zinc-100">
            {tasks.map((t) => {
              const overdue = t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
              return (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      t.priority === "urgent" ? "bg-red-500" :
                      t.priority === "high"   ? "bg-amber-400" :
                      t.priority === "normal" ? "bg-blue-400" : "bg-zinc-300"
                    }`} />
                    <span className="flex-1 min-w-0 truncate text-sm text-zinc-900">{t.title}</span>
                    {t.due_date && (
                      <span className={`text-xs flex-shrink-0 ${overdue ? "text-red-600 font-medium" : "text-zinc-500"}`}>
                        {overdue ? "Overdue · " : ""}
                        {format(parseISO(t.due_date), "MMM d")}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
