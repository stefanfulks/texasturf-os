import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO, isToday, isPast } from "date-fns";
import { Calendar, ListTodo, AlertTriangle, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PickDepartmentPrompt } from "./pick-department";
import { DashboardQuickSearch } from "./quick-search";
import {
  DEPARTMENT_LABEL,
  DEPARTMENT_EMOJI,
  DEPARTMENT_HREF,
  DEPARTMENT_DESCRIPTION,
  isDepartment,
  orderForUserMulti,
  parseDepartments,
  type Department,
} from "@/lib/departments";

export const metadata = { title: "TexasTurf OS" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ change?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const forceChange = params.change === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pull department alongside the rest. Cast through unknown until generated
  // types regenerate after the migration applies.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, department, departments")
    .eq("id", user.id)
    .single() as unknown as {
      data: {
        full_name: string | null;
        email: string;
        role: string;
        department: string | null;
        departments: unknown;
      } | null;
    };

  const greetingName =
    profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "there";

  // Multi-department: prefer the new `departments` array, fall back to the
  // legacy singular `department` if present.
  const departments: Department[] = (() => {
    const arr = parseDepartments(profile?.departments);
    if (arr.length > 0) return arr;
    if (profile?.department && isDepartment(profile.department)) return [profile.department];
    return [];
  })();
  const primaryDepartment: Department | null = departments[0] ?? null;

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

  // Department-specific "what's hot" stats — for the primary department.
  const deptStats = await loadDepartmentStats(supabase, primaryDepartment);

  // Tile ordering — user's departments first (in the order they picked
  // them), then the rest in canonical order.
  const orderedDepartments = orderForUserMulti(departments);
  const ownSet = new Set<Department>(departments);

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {greetingName}.
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {format(new Date(), "EEEE, MMMM d")}
          {profile?.role && ` · ${profile.role}`}
          {departments.length > 0 && (
            <>
              {" · "}
              {departments.map((d, i) => (
                <span key={d}>
                  {i > 0 && " · "}
                  {DEPARTMENT_LABEL[d]} {DEPARTMENT_EMOJI[d]}
                </span>
              ))}
            </>
          )}
        </p>
        </div>
        {profile?.role === "admin" && (
          <Link
            href="/team"
            className="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:border-purple-400 transition-colors"
          >
            Team →
          </Link>
        )}
      </div>

      {/* If no departments, or the user clicked "change department", show
          the multi-picker. */}
      {(departments.length === 0 || forceChange) && (
        <PickDepartmentPrompt initial={departments} />
      )}

      {/* Quick search across inventory */}
      <DashboardQuickSearch />

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
          value="View"
          tone="neutral"
          icon={<Calendar className="h-4 w-4" />}
          href="/calendar"
        />
      </div>

      {/* Department-specific snapshot — primary department */}
      {primaryDepartment && deptStats && (
        <section className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
            <h2 className="text-sm font-semibold">
              <span className="mr-2">{DEPARTMENT_EMOJI[primaryDepartment]}</span>
              {DEPARTMENT_LABEL[primaryDepartment]} snapshot
            </h2>
            <Link href={DEPARTMENT_HREF[primaryDepartment]} className="text-xs text-zinc-500 hover:text-zinc-900">
              Open {DEPARTMENT_LABEL[primaryDepartment]} →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-px bg-zinc-100 sm:grid-cols-4">
            {deptStats.map((s) => (
              <div key={s.label} className="bg-white px-4 py-3">
                <p className="text-xs text-zinc-400 mb-0.5">{s.label}</p>
                <p className={`text-xl font-semibold tabular-nums ${s.tone === "amber" ? "text-amber-700" : s.tone === "red" ? "text-red-700" : s.tone === "green" ? "text-emerald-700" : "text-zinc-900"}`}>
                  {s.value}
                </p>
                {s.hint && <p className="text-xs text-zinc-400 mt-0.5">{s.hint}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

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
            Inbox zero. Nothing&apos;s waiting on you.
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

      {/* Departments — user's own first */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Jump into a department
          </h2>
          {departments.length > 0 && (
            <Link href="/dashboard?change=1" className="text-xs text-zinc-400 hover:text-zinc-700">
              Change my departments
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {orderedDepartments.map((d) => (
            <DepartmentTile
              key={d}
              href={DEPARTMENT_HREF[d]}
              label={DEPARTMENT_LABEL[d]}
              emoji={DEPARTMENT_EMOJI[d]}
              description={DEPARTMENT_DESCRIPTION[d]}
              highlight={ownSet.has(d)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Department-specific stats ────────────────────────────────────────────────

type Tone = "neutral" | "amber" | "red" | "green";
type StatItem = { label: string; value: string | number; tone: Tone; hint?: string };

async function loadDepartmentStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  department: Department | null,
): Promise<StatItem[] | null> {
  if (!department) return null;

  switch (department) {
    case "warehouse": {
      const [openRolls, lowStock, pendingReceive, activeJobs] = await Promise.all([
        supabase.from("inv_rolls").select("id", { count: "exact", head: true }).in("status", ["available", "planned"]),
        supabase.from("inv_items").select("id, quantity, min_quantity").eq("active", true),
        supabase.from("inv_rolls").select("id", { count: "exact", head: true }).eq("status", "planned"),
        supabase.from("inv_jobs").select("id", { count: "exact", head: true }).in("status", ["in_progress", "staged"]),
      ]);
      const low = (lowStock.data ?? []).filter(
        (i) => i.min_quantity != null && i.quantity != null && i.quantity <= i.min_quantity,
      ).length;
      return [
        { label: "Open rolls",     value: openRolls.count ?? 0,     tone: "neutral" },
        { label: "Low-stock items", value: low,                      tone: low > 0 ? "red" : "neutral" },
        { label: "Pending receive", value: pendingReceive.count ?? 0, tone: (pendingReceive.count ?? 0) > 0 ? "amber" : "neutral" },
        { label: "Active jobs",    value: activeJobs.count ?? 0,    tone: "neutral" },
      ];
    }
    case "office": {
      const [needsReview, awaitingApproval, openProjects, vendors] = await Promise.all([
        supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["awaiting_review", "request_change", "ocr_review_needed"]),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "awaiting_approval"),
        supabase.from("projects").select("id", { count: "exact", head: true })
          .eq("archived", false).not("status", "in", "(complete,cancelled)"),
        supabase.from("vendors").select("id", { count: "exact", head: true }).eq("active", true),
      ]);
      return [
        { label: "Needs review",      value: needsReview.count ?? 0,      tone: (needsReview.count ?? 0) > 0 ? "amber" : "neutral" },
        { label: "Awaiting approval", value: awaitingApproval.count ?? 0, tone: (awaitingApproval.count ?? 0) > 0 ? "amber" : "neutral" },
        { label: "Open projects",     value: openProjects.count ?? 0,     tone: "neutral" },
        { label: "Active vendors",    value: vendors.count ?? 0,          tone: "neutral" },
      ];
    }
    case "sales": {
      const [openProjects, activeVendors] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true })
          .eq("archived", false).not("status", "in", "(complete,cancelled)"),
        supabase.from("vendors").select("id", { count: "exact", head: true }).eq("active", true).eq("type", "subcontractor"),
      ]);
      return [
        { label: "Quote tool", value: "Open", tone: "green", hint: "Pricing calculator" },
        { label: "Open projects", value: openProjects.count ?? 0, tone: "neutral" },
        { label: "Active subs", value: activeVendors.count ?? 0, tone: "neutral" },
        { label: "Lead pipeline", value: "—", tone: "neutral", hint: "coming soon" },
      ];
    }
    case "financial": {
      const [paid, approved, unpaid] = await Promise.all([
        supabase.from("invoices").select("total_amount").eq("status", "paid"),
        supabase.from("invoices").select("total_amount").eq("status", "approved"),
        supabase.from("invoices").select("total_amount").in("status", ["awaiting_review", "awaiting_approval", "approved"]),
      ]);
      const sum = (rows: { total_amount: number | null }[] | null) =>
        (rows ?? []).reduce((a, r) => a + (r.total_amount ?? 0), 0);
      const fmt = (n: number) =>
        `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
      return [
        { label: "Paid (all-time)",    value: fmt(sum(paid.data)),     tone: "green" },
        { label: "Approved unpaid",    value: fmt(sum(approved.data)), tone: (sum(approved.data) > 0 ? "amber" : "neutral") },
        { label: "All open balance",   value: fmt(sum(unpaid.data)),   tone: "neutral" },
        { label: "Budget",             value: "View",                  tone: "neutral", hint: "Reports → Budget" },
      ];
    }
    case "field": {
      const today = new Date().toISOString().slice(0, 10);
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      const [todayTasks, overdue] = await Promise.all([
        userId ? supabase.from("tasks").select("id", { count: "exact", head: true })
          .eq("assignee_id", userId).not("status", "in", "(done,archived)").eq("due_date", today)
          : Promise.resolve({ count: 0 }),
        userId ? supabase.from("tasks").select("id", { count: "exact", head: true })
          .eq("assignee_id", userId).not("status", "in", "(done,archived)").lt("due_date", today)
          : Promise.resolve({ count: 0 }),
      ]);
      return [
        { label: "Tasks today",   value: todayTasks.count ?? 0, tone: (todayTasks.count ?? 0) > 0 ? "amber" : "neutral" },
        { label: "Overdue",       value: overdue.count ?? 0,    tone: (overdue.count ?? 0) > 0 ? "red" : "neutral" },
        { label: "My schedule",   value: "View",                tone: "neutral", hint: "Calendar" },
        { label: "Time tracking", value: "—",                   tone: "neutral", hint: "coming soon" },
      ];
    }
    case "marketing": {
      // No marketing tables yet; placeholders.
      return [
        { label: "Content calendar", value: "—", tone: "neutral", hint: "coming soon" },
        { label: "Active campaigns", value: "—", tone: "neutral", hint: "coming soon" },
        { label: "Reviews this month", value: "—", tone: "neutral", hint: "coming soon" },
        { label: "Lead sources",     value: "—", tone: "neutral", hint: "coming soon" },
      ];
    }
  }
}

// ─── Small presentational components ──────────────────────────────────────────

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

function DepartmentTile({
  href, label, emoji, description, highlight,
}: {
  href: string;
  label: string;
  emoji: string;
  description: string;
  highlight: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "flex items-start gap-3 rounded-xl border bg-white px-4 py-3 transition-colors " +
        (highlight
          ? "border-blue-300 ring-1 ring-blue-200"
          : "border-zinc-200 hover:border-zinc-400")
      }
    >
      <span className="text-2xl mt-0.5">{emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-zinc-900">
          {label}
          {highlight && (
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
              Yours
            </span>
          )}
        </span>
        <span className="block text-xs text-zinc-500 mt-0.5">{description}</span>
      </span>
    </Link>
  );
}
