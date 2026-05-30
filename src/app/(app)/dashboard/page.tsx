import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO, isToday, isPast } from "date-fns";
import { Calendar, ListTodo, AlertTriangle, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "TexasTurf OS" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  const greetingName =
    profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "there";

  // Personal cards data
  const [myTasksRes, todayTasksRes, overdueTasksRes, attentionInvoicesRes] = await Promise.all([
    supabase.from("tasks").select("id, title, status, priority, due_date")
      .eq("assignee_id", user.id)
      .not("status", "in", "(done,archived)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .eq("assignee_id", user.id)
      .not("status", "in", "(done,archived)")
      .eq("due_date", new Date().toISOString().slice(0, 10)),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .eq("assignee_id", user.id)
      .not("status", "in", "(done,archived)")
      .lt("due_date", new Date().toISOString().slice(0, 10)),
    supabase.from("invoices").select("id", { count: "exact", head: true })
      .in("status", ["awaiting_review", "awaiting_approval", "request_change"]),
  ]);

  const tasks = myTasksRes.data ?? [];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {greetingName}.
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {format(new Date(), "EEEE, MMMM d")}
          {profile?.role && ` · ${profile.role}`}
        </p>
      </div>

      {/* At-a-glance row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Tasks today"
          value={todayTasksRes.count ?? 0}
          tone={(todayTasksRes.count ?? 0) > 0 ? "amber" : "neutral"}
          icon={<ListTodo className="h-4 w-4" />}
          href="/tasks"
        />
        <StatTile
          label="Overdue"
          value={overdueTasksRes.count ?? 0}
          tone={(overdueTasksRes.count ?? 0) > 0 ? "red" : "neutral"}
          icon={<AlertTriangle className="h-4 w-4" />}
          href="/tasks"
        />
        <StatTile
          label="Invoice attention"
          value={attentionInvoicesRes.count ?? 0}
          tone={(attentionInvoicesRes.count ?? 0) > 0 ? "blue" : "neutral"}
          icon={<BarChart3 className="h-4 w-4" />}
          href="/invoices?status=Needs+Action"
        />
        <StatTile
          label="Calendar"
          value={"View"}
          tone="neutral"
          icon={<Calendar className="h-4 w-4" />}
          href="/calendar"
        />
      </div>

      {/* My tasks */}
      <section className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold">My next tasks</h2>
          <Link href="/tasks" className="text-xs text-zinc-500 hover:text-zinc-900">
            All tasks →
          </Link>
        </div>
        {tasks.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-400">
            Inbox zero. Nothing's waiting on you.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {tasks.map((t) => {
              const overdue = t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
              return (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 transition-colors"
                  >
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
        )}
      </section>

      {/* Quick links to departments */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Jump into a department
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DepartmentTile href="/sales"     label="Sales"     emoji="💼" />
          <DepartmentTile href="/warehouse" label="Warehouse" emoji="📦" />
          <DepartmentTile href="/office"    label="Office"    emoji="🏢" />
          <DepartmentTile href="/financial" label="Financial" emoji="💰" />
        </div>
      </section>
    </div>
  );
}

function StatTile({
  label, value, tone, icon, href,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "amber" | "red" | "blue";
  icon: React.ReactNode;
  href: string;
}) {
  const toneMap = {
    neutral: "text-zinc-900",
    amber:   "text-amber-700",
    red:     "text-red-700",
    blue:    "text-blue-700",
  };
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-400 transition-colors"
    >
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span className="text-zinc-400">{icon}</span>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneMap[tone]}`}>{value}</div>
    </Link>
  );
}

function DepartmentTile({ href, label, emoji }: { href: string; label: string; emoji: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400 transition-colors"
    >
      <span className="text-xl">{emoji}</span>
      <span className="text-sm font-medium text-zinc-900">{label}</span>
    </Link>
  );
}
