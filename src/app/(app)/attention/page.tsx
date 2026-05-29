import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ─── helpers ────────────────────────────────────────────────────────────────

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── status badge ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  ocr_processing: "bg-purple-100 text-purple-700",
  ocr_review_needed: "bg-yellow-100 text-yellow-700",
  awaiting_review: "bg-yellow-100 text-yellow-700",
  awaiting_approval: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  request_change: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
  on_hold: "bg-zinc-100 text-zinc-500",
  paid: "bg-green-100 text-green-700",
  archived: "bg-zinc-100 text-zinc-400",
  draft: "bg-zinc-100 text-zinc-400",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-zinc-100 text-zinc-500";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-zinc-100 text-zinc-500",
};

function PriorityBadge({ priority }: { priority: string }) {
  const cls = PRIORITY_COLORS[priority] ?? "bg-zinc-100 text-zinc-500";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {priority}
    </span>
  );
}

// ─── section card ────────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  count,
  children,
}: {
  icon: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{icon}</span>
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        </div>
        {count > 0 ? (
          <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 min-w-[1.5rem]">
            {count}
          </span>
        ) : (
          <span className="inline-flex items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5">
            0
          </span>
        )}
      </div>
      <div className="divide-y divide-zinc-100">{children}</div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-5 py-4 text-sm text-green-600 font-medium">{message}</div>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────

export default async function AttentionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "field") {
    redirect("/");
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // ── fetch all data in parallel ──────────────────────────────────────────

  const [
    stuckInvoicesRes,
    overdueTasksRes,
    awaitingApprovalRes,
    allInvoicesForAnomalyRes,
    recentInvoicesRes,
    kpiEntriesRes,
  ] = await Promise.all([
    // 1. Stuck invoices
    supabase
      .from("invoices")
      .select("id, title, status, status_changed_at, total_amount, vendor_id")
      .not("status", "in", '("paid","archived","draft")')
      .lt("status_changed_at", sevenDaysAgo),

    // 2. Overdue tasks
    supabase
      .from("tasks")
      .select("id, title, due_date, status, priority, assignee_id")
      .not("status", "in", '("done","cancelled","archived")')
      .lt("due_date", today)
      .not("due_date", "is", null),

    // 3. Awaiting approval > 3 days
    supabase
      .from("invoices")
      .select("id, title, total_amount, status_changed_at")
      .eq("status", "awaiting_approval")
      .lt("status_changed_at", threeDaysAgo),

    // 4a. All paid/approved invoices for vendor avg computation
    supabase
      .from("invoices")
      .select("vendor_id, total_amount")
      .in("status", ["paid", "approved"])
      .not("vendor_id", "is", null)
      .not("total_amount", "is", null),

    // 4b. Recent invoices (last 30 days)
    supabase
      .from("invoices")
      .select("id, title, vendor_id, total_amount, status_changed_at")
      .gte("status_changed_at", thirtyDaysAgo)
      .not("vendor_id", "is", null)
      .not("total_amount", "is", null),

    // 5. KPI entries for current month
    supabase
      .from("kpi_entries")
      .select("*")
      .eq("period_month", currentMonth)
      .eq("period_year", currentYear)
      .not("actual_value", "is", null)
      .not("target_value", "is", null),
  ]);

  // ── stuck invoices ──────────────────────────────────────────────────────

  const stuckInvoices = stuckInvoicesRes.data ?? [];

  const stuckVendorIds = [
    ...new Set(stuckInvoices.map((i) => i.vendor_id).filter(Boolean) as string[]),
  ];

  const vendorMap: Record<string, string> = {};
  if (stuckVendorIds.length > 0) {
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, name")
      .in("id", stuckVendorIds);
    for (const v of vendors ?? []) {
      vendorMap[v.id] = v.name;
    }
  }

  // ── overdue tasks ───────────────────────────────────────────────────────

  const overdueTasks = overdueTasksRes.data ?? [];

  const assigneeIds = [
    ...new Set(overdueTasks.map((t) => t.assignee_id).filter(Boolean) as string[]),
  ];

  const assigneeMap: Record<string, string> = {};
  if (assigneeIds.length > 0) {
    const { data: assignees } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", assigneeIds);
    for (const a of assignees ?? []) {
      assigneeMap[a.id] = a.full_name ?? a.email;
    }
  }

  // ── awaiting approval ───────────────────────────────────────────────────

  const awaitingApproval = awaitingApprovalRes.data ?? [];

  // ── vendor anomalies ────────────────────────────────────────────────────

  type VendorAvgMap = Record<string, { sum: number; count: number }>;

  const allInvoicesForAvg = allInvoicesForAnomalyRes.data ?? [];
  const vendorAvgMap: VendorAvgMap = {};
  for (const inv of allInvoicesForAvg) {
    if (!inv.vendor_id || inv.total_amount == null) continue;
    if (!vendorAvgMap[inv.vendor_id]) {
      vendorAvgMap[inv.vendor_id] = { sum: 0, count: 0 };
    }
    vendorAvgMap[inv.vendor_id].sum += inv.total_amount;
    vendorAvgMap[inv.vendor_id].count += 1;
  }

  const recentInvoices = recentInvoicesRes.data ?? [];

  const anomalyVendorIds = [
    ...new Set(recentInvoices.map((i) => i.vendor_id).filter(Boolean) as string[]),
  ];

  const anomalyVendorMap: Record<string, string> = {};
  if (anomalyVendorIds.length > 0) {
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, name")
      .in("id", anomalyVendorIds);
    for (const v of vendors ?? []) {
      anomalyVendorMap[v.id] = v.name;
      // also populate main vendorMap
      vendorMap[v.id] = v.name;
    }
  }

  type Anomaly = {
    invoiceId: string;
    invoiceTitle: string;
    vendorId: string;
    vendorName: string;
    amount: number;
    vendorAvg: number;
    pctOver: number;
  };

  const anomalies: Anomaly[] = [];
  for (const inv of recentInvoices) {
    if (!inv.vendor_id || inv.total_amount == null) continue;
    const stats = vendorAvgMap[inv.vendor_id];
    if (!stats || stats.count < 2) continue; // need at least 2 data points
    const avg = stats.sum / stats.count;
    if (inv.total_amount > avg * 1.2) {
      anomalies.push({
        invoiceId: inv.id,
        invoiceTitle: inv.title,
        vendorId: inv.vendor_id,
        vendorName: anomalyVendorMap[inv.vendor_id] ?? inv.vendor_id,
        amount: inv.total_amount,
        vendorAvg: avg,
        pctOver: ((inv.total_amount - avg) / avg) * 100,
      });
    }
  }

  // ── KPI flags ───────────────────────────────────────────────────────────

  type KpiFlag = {
    id: string;
    kpi_label: string;
    actual_value: number;
    target_value: number;
    pctOff: number;
    direction: "below" | "above";
    createdBy: string | null;
  };

  const kpiEntries = kpiEntriesRes.data ?? [];
  const kpiFlags: KpiFlag[] = [];

  for (const entry of kpiEntries) {
    if (entry.actual_value == null || entry.target_value == null || entry.target_value === 0)
      continue;

    const ratio = entry.actual_value / entry.target_value;
    // lower-is-better heuristic: if kpi_key contains "cost", "time", "wait", "overdue"
    const lowerIsBetter = /cost|expense|time|wait|overdue|late/i.test(entry.kpi_key);

    if (!lowerIsBetter && ratio < 0.9) {
      kpiFlags.push({
        id: entry.id,
        kpi_label: entry.kpi_label,
        actual_value: entry.actual_value,
        target_value: entry.target_value,
        pctOff: (1 - ratio) * 100,
        direction: "below",
        createdBy: entry.created_by,
      });
    } else if (lowerIsBetter && ratio > 1.1) {
      kpiFlags.push({
        id: entry.id,
        kpi_label: entry.kpi_label,
        actual_value: entry.actual_value,
        target_value: entry.target_value,
        pctOff: (ratio - 1) * 100,
        direction: "above",
        createdBy: entry.created_by,
      });
    }
  }

  // Fetch KPI reporter names
  const kpiReporterIds = [
    ...new Set(kpiFlags.map((k) => k.createdBy).filter(Boolean) as string[]),
  ];
  const kpiReporterMap: Record<string, string> = {};
  if (kpiReporterIds.length > 0) {
    const { data: reporters } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", kpiReporterIds);
    for (const r of reporters ?? []) {
      kpiReporterMap[r.id] = r.full_name ?? r.email;
    }
  }

  // ── summary counts ──────────────────────────────────────────────────────

  const totalCount =
    stuckInvoices.length +
    overdueTasks.length +
    awaitingApproval.length +
    anomalies.length +
    kpiFlags.length;

  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Attention Board</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Items flagged across all modules
        </p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Stuck Invoices", count: stuckInvoices.length, color: "bg-red-50 border-red-200 text-red-700" },
          { label: "Overdue Tasks", count: overdueTasks.length, color: "bg-orange-50 border-orange-200 text-orange-700" },
          { label: "Approval Urgency", count: awaitingApproval.length, color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
          { label: "Pricing Anomalies", count: anomalies.length + kpiFlags.length, color: "bg-purple-50 border-purple-200 text-purple-700" },
        ].map(({ label, count, color }) => (
          <div
            key={label}
            className={`rounded-xl border px-4 py-3 ${color}`}
          >
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
          </div>
        ))}
      </div>

      {totalCount === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-6 text-center">
          <p className="text-green-700 font-semibold text-sm">
            All clear — no items need attention right now.
          </p>
        </div>
      )}

      {/* ── Stuck Invoices ── */}
      <SectionCard icon="🧾" title="Stuck Invoices" count={stuckInvoices.length}>
        {stuckInvoices.length === 0 ? (
          <EmptyRow message="✓ No stuck invoices" />
        ) : (
          stuckInvoices.map((inv) => {
            const daysStuck = daysBetween(inv.status_changed_at, now);
            return (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="text-sm font-medium text-zinc-900 hover:text-blue-600 truncate block"
                  >
                    {inv.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {inv.vendor_id && vendorMap[inv.vendor_id] && (
                      <span className="text-xs text-zinc-500">
                        {vendorMap[inv.vendor_id]}
                      </span>
                    )}
                    <StatusBadge status={inv.status} />
                    <span className="text-xs font-medium text-amber-600">
                      stuck {daysStuck}d
                    </span>
                  </div>
                </div>
                <div className="text-sm font-semibold text-zinc-700 shrink-0">
                  {fmtMoney(inv.total_amount)}
                </div>
              </div>
            );
          })
        )}
      </SectionCard>

      {/* ── Overdue Tasks ── */}
      <SectionCard icon="⚠️" title="Overdue Tasks" count={overdueTasks.length}>
        {overdueTasks.length === 0 ? (
          <EmptyRow message="✓ No overdue tasks" />
        ) : (
          overdueTasks.map((task) => {
            const daysOverdue = task.due_date
              ? daysBetween(task.due_date, now)
              : 0;
            const dueDateFormatted = task.due_date
              ? new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "—";
            return (
              <div
                key={task.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="text-sm font-medium text-zinc-900 hover:text-blue-600 truncate block"
                  >
                    {task.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {task.assignee_id && assigneeMap[task.assignee_id] && (
                      <span className="text-xs text-zinc-500">
                        {assigneeMap[task.assignee_id]}
                      </span>
                    )}
                    <span className="text-xs text-zinc-400">{dueDateFormatted}</span>
                    <span className="text-xs font-medium text-red-600">
                      {daysOverdue}d overdue
                    </span>
                    <PriorityBadge priority={task.priority} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </SectionCard>

      {/* ── Approval Urgency ── */}
      <SectionCard icon="🔴" title="Approval Urgency" count={awaitingApproval.length}>
        {awaitingApproval.length === 0 ? (
          <EmptyRow message="✓ No urgent approvals" />
        ) : (
          awaitingApproval.map((inv) => {
            const daysWaiting = daysBetween(inv.status_changed_at, now);
            return (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="text-sm font-medium text-zinc-900 hover:text-blue-600 truncate block"
                  >
                    {inv.title}
                  </Link>
                  <p className="text-xs text-orange-600 font-medium mt-0.5">
                    waiting {daysWaiting}d for approval
                  </p>
                </div>
                <div className="text-sm font-semibold text-zinc-700 shrink-0">
                  {fmtMoney(inv.total_amount)}
                </div>
              </div>
            );
          })
        )}
      </SectionCard>

      {/* ── Vendor Pricing Anomalies ── */}
      <SectionCard icon="📊" title="Vendor Pricing Anomalies" count={anomalies.length}>
        {anomalies.length === 0 ? (
          <EmptyRow message="✓ No pricing anomalies" />
        ) : (
          anomalies.map((a) => (
            <div
              key={a.invoiceId}
              className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/invoices/${a.invoiceId}`}
                  className="text-sm font-medium text-zinc-900 hover:text-blue-600 truncate block"
                >
                  {a.invoiceTitle}
                </Link>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-zinc-500">{a.vendorName}</span>
                  <span className="text-xs text-zinc-400">
                    avg {fmtMoney(a.vendorAvg)}
                  </span>
                  <span className="text-xs font-semibold text-red-600">
                    +{a.pctOver.toFixed(0)}% over avg
                  </span>
                </div>
              </div>
              <div className="text-sm font-semibold text-zinc-700 shrink-0">
                {fmtMoney(a.amount)}
              </div>
            </div>
          ))
        )}
      </SectionCard>

      {/* ── Team KPI Flags ── */}
      <SectionCard icon="👥" title="Team KPI Flags" count={kpiFlags.length}>
        {kpiFlags.length === 0 ? (
          <EmptyRow message="✓ All KPIs on track" />
        ) : (
          kpiFlags.map((flag) => (
            <div
              key={flag.id}
              className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">
                  {flag.kpi_label}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {flag.createdBy && kpiReporterMap[flag.createdBy] && (
                    <span className="text-xs text-zinc-500">
                      {kpiReporterMap[flag.createdBy]}
                    </span>
                  )}
                  <span className="text-xs text-zinc-400">
                    actual {flag.actual_value} / target {flag.target_value}
                  </span>
                  <span className="text-xs font-semibold text-red-600">
                    {flag.direction === "below" ? "−" : "+"}
                    {flag.pctOff.toFixed(0)}% off target
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </SectionCard>
    </div>
  );
}
