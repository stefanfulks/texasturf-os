import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO, isToday, isPast } from "date-fns";
import { Calendar, ListTodo, AlertTriangle, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyTaskIds, NO_TASK_UUID } from "@/lib/tasks/scope";
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

  // Personal cards data — multi-assignee aware: include tasks where the user
  // is a co-assignee, not just the legacy primary (tasks.assignee_id).
  const myIds = await getMyTaskIds(supabase, user.id);
  const scopeIds = myIds.length === 0 ? [NO_TASK_UUID] : myIds;
  const today = new Date().toISOString().slice(0, 10);
  const [myTasksRes, todayTasksRes, overdueTasksRes, attentionInvoicesRes] = await Promise.all([
    supabase.from("tasks").select("id, title, status, priority, due_date")
      .in("id", scopeIds)
      .not("status", "in", "(done,archived)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .in("id", scopeIds)
      .not("status", "in", "(done,archived)")
      .eq("due_date", today),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .in("id", scopeIds)
      .not("status", "in", "(done,archived)")
      .lt("due_date", today),
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
    <div className="mx-auto max-w-6xl space-y-7">
      {/* Greeting */}
      <div className="reveal flex items-end justify-between gap-4 flex-wrap" style={{ animationDelay: "0ms" }}>
        <div>
          <p className="eyebrow">
            {format(new Date(), "EEEE, MMMM d")}
            {profile?.role && ` · ${profile.role}`}
          </p>
          <h1 className="display mt-2 text-[2rem] leading-[1.05] text-ink sm:text-[2.375rem]">
            Welcome back, {greetingName}.
          </h1>
          {departments.length > 0 && (
            <p className="mt-2 text-sm text-ink-3">
              {departments.map((d, i) => (
                <span key={d}>
                  {i > 0 && <span className="text-ink-4"> · </span>}
                  {DEPARTMENT_LABEL[d]} {DEPARTMENT_EMOJI[d]}
                </span>
              ))}
            </p>
          )}
        </div>
        {profile?.role === "admin" && (
          <Link href="/team" className="btn btn-line btn-sm">
            Team performance →
          </Link>
        )}
      </div>

      {/* If no departments, or the user clicked "change department", show
          the multi-picker. */}
      {(departments.length === 0 || forceChange) && (
        <PickDepartmentPrompt initial={departments} />
      )}

      {/* Quick search across inventory */}
      <div className="reveal" style={{ animationDelay: "60ms" }}>
        <DashboardQuickSearch />
      </div>

      {/* At-a-glance row */}
      <div className="reveal grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: "120ms" }}>
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
        <section className="reveal panel" style={{ animationDelay: "180ms" }}>
          <div className="panel-head">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span>{DEPARTMENT_EMOJI[primaryDepartment]}</span>
              {DEPARTMENT_LABEL[primaryDepartment]} snapshot
            </h2>
            <Link href={DEPARTMENT_HREF[primaryDepartment]} className="text-xs font-medium text-ink-3 hover:text-brand transition-colors">
              Open {DEPARTMENT_LABEL[primaryDepartment]} →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            {deptStats.map((s) => {
              const toneClass =
                s.tone === "amber" ? "text-warn" :
                s.tone === "red"   ? "text-danger" :
                s.tone === "green" ? "text-brand" : "text-ink";
              const inner = (
                <>
                  <p className="eyebrow">{s.label}</p>
                  <p className={`mt-1.5 display text-2xl tabular-nums ${toneClass}`}>
                    {s.value}
                  </p>
                  {s.hint && <p className="mt-1 text-xs text-ink-4">{s.hint}</p>}
                </>
              );
              return s.href ? (
                <Link
                  key={s.label}
                  href={s.href}
                  className="row-link bg-surface px-4 py-3.5"
                >
                  {inner}
                </Link>
              ) : (
                <div key={s.label} className="bg-surface px-4 py-3.5">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* My tasks */}
      <section className="reveal panel" style={{ animationDelay: "240ms" }}>
        <div className="panel-head">
          <h2 className="text-sm font-semibold text-ink">My next tasks</h2>
          <Link href="/tasks" className="text-xs font-medium text-ink-3 hover:text-brand transition-colors">
            All tasks →
          </Link>
        </div>
        {tasks.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-ink-2">Inbox zero.</p>
            <p className="mt-1 text-xs text-ink-4">Nothing&apos;s waiting on you.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((t) => {
              const overdue = t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
              return (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="row-link flex items-center gap-3 px-5 py-3"
                  >
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      t.priority === "urgent" ? "bg-danger" :
                      t.priority === "high"   ? "bg-warn" :
                      t.priority === "normal" ? "bg-info" : "bg-ink-4"
                    }`} />
                    <span className="flex-1 min-w-0 truncate text-sm text-ink">{t.title}</span>
                    {t.due_date && (
                      <span className={`text-xs flex-shrink-0 tabular-nums ${overdue ? "text-danger font-semibold" : "text-ink-3"}`}>
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
      <section className="reveal" style={{ animationDelay: "300ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="eyebrow">Jump into a department</h2>
          {departments.length > 0 && (
            <Link href="/dashboard?change=1" className="text-xs text-ink-4 hover:text-ink-2 transition-colors">
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
type StatItem = { label: string; value: string | number; tone: Tone; hint?: string; href?: string };

async function loadDepartmentStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  department: Department | null,
): Promise<StatItem[] | null> {
  if (!department) return null;

  switch (department) {
    case "warehouse": {
      const today = new Date().toISOString().slice(0, 10);
      // Pull the operations counts in parallel with the inventory rollups so
      // the tile grid mixes "what's moving today" with "what's low".
      const [lowStock, pullsToday, openPulls, deliveriesToday] = await Promise.all([
        supabase.from("inv_items").select("id, quantity, min_quantity").eq("active", true),
        supabase.from("warehouse_pull_lists").select("id", { count: "exact", head: true })
          .eq("job_date", today),
        supabase.from("warehouse_pull_lists").select("id", { count: "exact", head: true })
          .in("status", ["draft", "pulled", "staged", "dispatched"]),
        supabase.from("warehouse_deliveries").select("id", { count: "exact", head: true })
          .gte("delivered_at", `${today}T00:00:00Z`)
          .lte("delivered_at", `${today}T23:59:59Z`),
      ]);
      const low = (lowStock.data ?? []).filter(
        (i) => i.min_quantity != null && i.quantity != null && i.quantity <= i.min_quantity,
      ).length;
      return [
        { label: "Pull lists today",  value: pullsToday.count ?? 0,
          tone: (pullsToday.count ?? 0) > 0 ? "amber" : "neutral",
          href: "/operations/pull-lists" },
        { label: "Open pull lists",   value: openPulls.count ?? 0,
          tone: "neutral",
          href: "/operations/pull-lists" },
        { label: "Deliveries today",  value: deliveriesToday.count ?? 0,
          tone: "neutral",
          href: "/operations/deliveries" },
        { label: "Low-stock items",   value: low,
          tone: low > 0 ? "red" : "neutral",
          href: "/inventory" },
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
        { label: "Open jobs",         value: openProjects.count ?? 0,     tone: "neutral" },
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
        { label: "Open jobs", value: openProjects.count ?? 0, tone: "neutral" },
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
      const myIds = userId ? await getMyTaskIds(supabase, userId) : [];
      const scopeIds = myIds.length === 0 ? [NO_TASK_UUID] : myIds;

      // Pull lists for me today: find this OS user's warehouse_employees row,
      // then count pull_lists with that employee_id on any crew slot for today.
      const { data: myEmp } = userId
        ? await supabase.from("warehouse_employees").select("id").eq("profile_id", userId).maybeSingle()
        : { data: null };
      const myEmpId = (myEmp as unknown as { id: string } | null)?.id;
      const myPullsTodayPromise = myEmpId
        ? supabase.from("warehouse_pull_lists").select("id", { count: "exact", head: true })
            .eq("job_date", today)
            .or(`crew_lead_employee_id.eq.${myEmpId},driver_employee_id.eq.${myEmpId},stager_employee_id.eq.${myEmpId}`)
        : Promise.resolve({ count: 0 });

      const [todayTasks, overdue, myPullsToday] = await Promise.all([
        userId ? supabase.from("tasks").select("id", { count: "exact", head: true })
          .in("id", scopeIds).not("status", "in", "(done,archived)").eq("due_date", today)
          : Promise.resolve({ count: 0 }),
        userId ? supabase.from("tasks").select("id", { count: "exact", head: true })
          .in("id", scopeIds).not("status", "in", "(done,archived)").lt("due_date", today)
          : Promise.resolve({ count: 0 }),
        myPullsTodayPromise,
      ]);
      return [
        { label: "Tasks today",   value: todayTasks.count ?? 0,
          tone: (todayTasks.count ?? 0) > 0 ? "amber" : "neutral",
          href: "/tasks" },
        { label: "Overdue tasks", value: overdue.count ?? 0,
          tone: (overdue.count ?? 0) > 0 ? "red" : "neutral",
          href: "/tasks" },
        { label: "Pull lists today", value: myPullsToday.count ?? 0,
          tone: (myPullsToday.count ?? 0) > 0 ? "amber" : "neutral",
          href: "/operations/pull-lists",
          hint: myEmpId ? undefined : "Link your profile to warehouse_employees" },
        { label: "My schedule",   value: "View",
          tone: "neutral", hint: "Calendar", href: "/calendar" },
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
  const num =
    tone === "amber" ? "text-warn" :
    tone === "red"   ? "text-danger" :
    tone === "blue"  ? "text-info" : "text-ink";
  const chip =
    tone === "amber" ? "bg-warn-tint text-warn" :
    tone === "red"   ? "bg-danger-tint text-danger" :
    tone === "blue"  ? "bg-info-tint text-info" : "bg-sunken text-ink-3";
  return (
    <Link href={href} className="card card-hover group p-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${chip}`}>
          {icon}
        </span>
      </div>
      <div className={`mt-3 display text-[1.75rem] leading-none tabular-nums ${num}`}>
        {value}
      </div>
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
        "card card-hover flex items-start gap-3 px-4 py-3.5 " +
        (highlight ? "ring-1 ring-brand-line" : "")
      }
    >
      <span className="text-2xl mt-0.5 leading-none">{emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {label}
          {highlight && <span className="chip chip-brand">Yours</span>}
        </span>
        <span className="block text-xs text-ink-3 mt-1 leading-snug">{description}</span>
      </span>
    </Link>
  );
}
