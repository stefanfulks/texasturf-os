import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO, isToday, isPast } from "date-fns";
import { Calendar, ListTodo, AlertTriangle, BarChart3, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyTaskIds, NO_TASK_UUID } from "@/lib/tasks/scope";
import { upcomingOccurrence } from "@/lib/meetings/cadence";
import { getAllDeals, getLastActivityMap } from "@/lib/sales/queries";
import { openPipelineValue, weightedPipeline, winRate, closingThisMonth } from "@/lib/sales/rollups";
import { assessDeal } from "@/lib/sales/risk";
import { today as salesToday } from "@/lib/sales/dates";
import { usd } from "@/lib/sales/format";
import { STAGE_LABELS } from "@/lib/sales/labels";
import type { DealActivity, Health } from "@/lib/sales/types";
import { PickDepartmentPrompt } from "./pick-department";
import { DashboardQuickSearch } from "./quick-search";
import {
  DEPARTMENT_LABEL,
  DEPARTMENT_ICON,
  DEPARTMENT_HREF,
  DEPARTMENT_DESCRIPTION,
  isDepartment,
  orderForUserMulti,
  parseDepartments,
  type Department,
} from "@/lib/departments";

/** Renders a department's SVG icon (replaces the old emoji glyph). */
function DeptIcon({ dept, className }: { dept: Department; className?: string }) {
  const Icon = DEPARTMENT_ICON[dept];
  return <Icon className={className} />;
}

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
  const [myTasksRes, todayTasksRes, overdueTasksRes, attentionInvoicesRes, meetingsRes] = await Promise.all([
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
    // Meetings the user can see (RLS-scoped) — we resolve "today" client-side
    // because occurrence depends on cadence + day-of-week/month.
    supabase.from("meetings").select("cadence, day_of_week, day_of_month, scheduled_on").eq("archived", false),
  ]);

  const tasks = myTasksRes.data ?? [];

  // Count meetings whose next occurrence lands today. Derive the "today" key
  // through the same helper so the date representation always matches; skip
  // adhoc (unscheduled) meetings so they don't count every day.
  const meetingTodayKey = upcomingOccurrence({ cadence: "daily", day_of_week: null, day_of_month: null });
  const meetingsToday = (meetingsRes.data ?? []).filter(
    (m) => m.cadence !== "adhoc" && upcomingOccurrence(m) === meetingTodayKey,
  ).length;

  // Department-specific "what's hot" stats — for the primary department.
  const deptStats = await loadDepartmentStats(supabase, primaryDepartment);

  // Pipeline strip — sales rollups + the deals most at risk. Sales tables may
  // not exist yet (migration gated), in which case the queries return [] and
  // this renders zeros / an empty list rather than throwing.
  const pipeline = await loadPipelineStrip();

  // Tile ordering — user's departments first (in the order they picked
  // them), then the rest in canonical order.
  const orderedDepartments = orderForUserMulti(departments);
  const ownSet = new Set<Department>(departments);
  // Lead with the user's own departments; everything else tucks behind a
  // disclosure so the dashboard isn't a wall of eight tiles.
  const ownDepartments = orderedDepartments.filter((d) => ownSet.has(d));
  const otherDepartments = orderedDepartments.filter((d) => !ownSet.has(d));

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
                  <span className="inline-flex items-center gap-1 align-middle">
                    <DeptIcon dept={d} className="h-3.5 w-3.5 text-ink-4" />
                    {DEPARTMENT_LABEL[d]}
                  </span>
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
          label="Meetings today"
          value={meetingsToday}
          tone={meetingsToday > 0 ? "blue" : "neutral"}
          icon={<Calendar className="h-4 w-4" />}
          href="/meetings"
        />
      </div>

      {/* Department-specific snapshot — primary department */}
      {primaryDepartment && deptStats && (
        <section className="reveal panel" style={{ animationDelay: "180ms" }}>
          <div className="panel-head">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="medallion medallion-brand !h-6 !w-6 !rounded-lg">
                <DeptIcon dept={primaryDepartment} className="h-3.5 w-3.5" />
              </span>
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

      {/* Pipeline strip — KPI tiles + deals needing attention */}
      <section className="reveal panel" style={{ animationDelay: "210ms" }}>
        <div className="panel-head">
          <h2 className="text-sm font-semibold text-ink">Pipeline</h2>
          <Link href="/sales" className="text-xs font-medium text-ink-3 hover:text-brand transition-colors">
            Open Sales →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          <PipelineTile label="Open pipeline"   value={usd(pipeline.open)} />
          <PipelineTile label="Weighted"        value={usd(pipeline.weighted)} />
          <PipelineTile label="Win rate (90d)"  value={`${Math.round(pipeline.winRate * 100)}%`} />
          <PipelineTile label="Closing this mo." value={usd(pipeline.closing)} tone="brand" />
        </div>
        {pipeline.attention.length > 0 && (
          <ul className="divide-y divide-line border-t border-line">
            {pipeline.attention.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/sales/deals/${d.id}`}
                  className="row-link flex items-center gap-3 px-5 py-3"
                >
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${d.health === "red" ? "bg-danger" : "bg-warn"}`} />
                  <span className="flex-1 min-w-0 truncate text-sm text-ink">{d.name}</span>
                  <span className="hidden sm:block flex-shrink-0 truncate text-xs text-ink-4 max-w-[40%]">
                    {d.reason}
                  </span>
                  <span className="flex-shrink-0 text-xs tabular-nums text-ink-3">{d.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

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

      {/* Departments — your own up front, the rest tucked behind a disclosure */}
      <section className="reveal" style={{ animationDelay: "300ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="eyebrow">
            {ownDepartments.length > 0 ? "Your departments" : "Jump into a department"}
          </h2>
          {departments.length > 0 && (
            <Link href="/dashboard?change=1" className="text-xs text-ink-4 hover:text-ink-2 transition-colors">
              Change my departments
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(ownDepartments.length > 0 ? ownDepartments : orderedDepartments).map((d) => (
            <DepartmentTile
              key={d}
              href={DEPARTMENT_HREF[d]}
              label={DEPARTMENT_LABEL[d]}
              dept={d}
              description={DEPARTMENT_DESCRIPTION[d]}
              highlight={ownSet.has(d)}
            />
          ))}
        </div>

        {ownDepartments.length > 0 && otherDepartments.length > 0 && (
          <details className="group mt-3">
            <summary className="flex items-center gap-1.5 cursor-pointer select-none list-none text-xs font-medium text-ink-3 hover:text-ink-2 transition-colors [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              Explore other departments
            </summary>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mt-3">
              {otherDepartments.map((d) => (
                <DepartmentTile
                  key={d}
                  href={DEPARTMENT_HREF[d]}
                  label={DEPARTMENT_LABEL[d]}
                  dept={d}
                  description={DEPARTMENT_DESCRIPTION[d]}
                  highlight={false}
                />
              ))}
            </div>
          </details>
        )}
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
      const [activeCampaigns, queuedCalls, openReferrals, rewardsDue] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase.from("referral_outreach").select("id", { count: "exact", head: true })
          .eq("call_status", "queued"),
        supabase.from("referrals").select("id", { count: "exact", head: true })
          .not("stage", "in", "(completed_paid,lost)"),
        supabase.from("referrals").select("id", { count: "exact", head: true })
          .eq("reward_status", "due"),
      ]);
      return [
        { label: "Active campaigns", value: activeCampaigns.count ?? 0,
          tone: "neutral", href: "/marketing" },
        { label: "Calls remaining", value: queuedCalls.count ?? 0,
          tone: (queuedCalls.count ?? 0) > 0 ? "amber" : "neutral",
          href: "/marketing/referrals" },
        { label: "Open referrals", value: openReferrals.count ?? 0,
          tone: "neutral",
          href: "/marketing/referrals" },
        { label: "Rewards due", value: rewardsDue.count ?? 0,
          tone: (rewardsDue.count ?? 0) > 0 ? "red" : "neutral",
          href: "/marketing/referrals" },
      ];
    }
  }
}

// ─── Pipeline strip data ──────────────────────────────────────────────────────

type AttentionDeal = { id: string; name: string; value: string; reason: string; health: Health };

async function loadPipelineStrip(): Promise<{
  open: number;
  weighted: number;
  winRate: number;
  closing: number;
  attention: AttentionDeal[];
}> {
  // getAllDeals() is RLS-scoped via the sales query layer; returns [] if the
  // sales tables don't exist yet, so the whole strip degrades to zeros.
  const deals = await getAllDeals();
  const now = salesToday();

  // Last-activity timestamp per deal so assessDeal's "gone quiet" rule reads a
  // real last touch. Passing [] would flag every deal as "No activity logged";
  // we synthesize one stand-in activity carrying the true occurred_at instead.
  const lastActivity = await getLastActivityMap(deals.map((d) => d.id));

  const attention = deals
    .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
    .map((deal) => {
      const lastAt = lastActivity[deal.id];
      const activities: DealActivity[] = lastAt
        ? [{
            id: `last-${deal.id}`,
            deal_id: deal.id,
            kind: "note",
            body: null,
            direction: null,
            metadata: {},
            occurred_at: lastAt,
            created_by: null,
          }]
        : [];
      const { flags, health } = assessDeal(deal, activities, now);
      return { deal, flags, health };
    })
    .filter((d) => d.health !== "green")
    .sort((a, b) =>
      a.health === b.health
        ? (b.deal.value_usd ?? 0) - (a.deal.value_usd ?? 0)
        : a.health === "red" ? -1 : 1,
    )
    .slice(0, 5)
    .map(({ deal, flags, health }) => ({
      id:     deal.id,
      name:   deal.name,
      value:  usd(deal.value_usd),
      reason: flags[0]?.label ?? STAGE_LABELS[deal.stage],
      health,
    }));

  return {
    open:     openPipelineValue(deals),
    weighted: weightedPipeline(deals),
    winRate:  winRate(deals, 90, now),
    closing:  closingThisMonth(deals, now),
    attention,
  };
}

// ─── Small presentational components ──────────────────────────────────────────

function PipelineTile({
  label, value, tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "brand";
}) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1.5 display text-2xl tabular-nums ${tone === "brand" ? "text-brand" : "text-ink"}`}>
        {value}
      </p>
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
  href, label, dept, description, highlight,
}: {
  href: string;
  label: string;
  dept: Department;
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
      <span className={"medallion " + (highlight ? "medallion-brand" : "")}>
        <DeptIcon dept={dept} className="h-[18px] w-[18px]" />
      </span>
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
