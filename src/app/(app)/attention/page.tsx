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
  submitted: "bg-info-tint text-info",
  ocr_processing: "bg-info-tint text-info",
  ocr_review_needed: "bg-warn-tint text-warn",
  awaiting_review: "bg-warn-tint text-warn",
  awaiting_approval: "bg-warn-tint text-warn",
  approved: "bg-brand-tint text-brand",
  request_change: "bg-danger-tint text-danger",
  rejected: "bg-danger-tint text-danger",
  on_hold: "bg-sunken text-ink-3",
  paid: "bg-brand-tint text-brand",
  archived: "bg-sunken text-ink-4",
  draft: "bg-sunken text-ink-4",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-sunken text-ink-3";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-danger-tint text-danger",
  high: "bg-warn-tint text-warn",
  normal: "bg-info-tint text-info",
  low: "bg-sunken text-ink-3",
};

function PriorityBadge({ priority }: { priority: string }) {
  const cls = PRIORITY_COLORS[priority] ?? "bg-sunken text-ink-3";
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
    <div className="rounded-xl border border-line bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{icon}</span>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
        {count > 0 ? (
          <span className="inline-flex items-center justify-center rounded-full bg-danger-tint text-danger text-xs font-bold px-2 py-0.5 min-w-[1.5rem]">
            {count}
          </span>
        ) : (
          <span className="inline-flex items-center justify-center rounded-full bg-brand-tint text-brand text-xs font-bold px-2 py-0.5">
            0
          </span>
        )}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-5 py-4 text-sm text-brand font-medium">{message}</div>
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
        <h1 className="text-2xl font-bold text-ink">Attention Board</h1>
        <p className="text-sm text-ink-3 mt-1">
          Items flagged across all modules
        </p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Stuck Invoices", count: stuckInvoices.length, color: "bg-danger-tint border-danger/30 text-danger" },
          { label: "Overdue Tasks", count: overdueTasks.length, color: "bg-warn-tint border-warn/30 text-warn" },
          { label: "Approval Urgency", count: awaitingApproval.length, color: "bg-warn-tint border-warn/30 text-warn" },
          { label: "Pricing Anomalies", count: anomalies.length + kpiFlags.length, color: "bg-info-tint border-info/30 text-info" },
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
        <div className="rounded-xl border border-brand/30 bg-brand-tint px-5 py-6 text-center">
          <p className="text-brand font-semibold text-sm">
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
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-hover transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="text-sm font-medium text-ink hover:text-info truncate block"
                  >
                    {inv.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {inv.vendor_id && vendorMap[inv.vendor_id] && (
                      <span className="text-xs text-ink-3">
                        {vendorMap[inv.vendor_id]}
                      </span>
                    )}
                    <StatusBadge status={inv.status} />
                    <span className="text-xs font-medium text-warn">
                      stuck {daysStuck}d
                    </span>
                  </div>
                </div>
                <div className="text-sm font-semibold text-ink-2 shrink-0">
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
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-hover transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="text-sm font-medium text-ink hover:text-info truncate block"
                  >
                    {task.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {task.assignee_id && assigneeMap[task.assignee_id] && (
                      <span className="text-xs text-ink-3">
                        {assigneeMap[task.assignee_id]}
                      </span>
                    )}
                    <span className="text-xs text-ink-4">{dueDateFormatted}</span>
                    <span className="text-xs font-medium text-danger">
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
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-hover transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="text-sm font-medium text-ink hover:text-info truncate block"
                  >
                    {inv.title}
                  </Link>
                  <p className="text-xs text-warn font-medium mt-0.5">
                    waiting {daysWaiting}d for approval
                  </p>
                </div>
                <div className="text-sm font-semibold text-ink-2 shrink-0">
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
              className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-hover transition-colors"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/invoices/${a.invoiceId}`}
                  className="text-sm font-medium text-ink hover:text-info truncate block"
                >
                  {a.invoiceTitle}
                </Link>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-ink-3">{a.vendorName}</span>
                  <span className="text-xs text-ink-4">
                    avg {fmtMoney(a.vendorAvg)}
                  </span>
                  <span className="text-xs font-semibold text-danger">
                    +{a.pctOver.toFixed(0)}% over avg
                  </span>
                </div>
              </div>
              <div className="text-sm font-semibold text-ink-2 shrink-0">
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
              className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-hover transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {flag.kpi_label}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {flag.createdBy && kpiReporterMap[flag.createdBy] && (
                    <span className="text-xs text-ink-3">
                      {kpiReporterMap[flag.createdBy]}
                    </span>
                  )}
                  <span className="text-xs text-ink-4">
                    actual {flag.actual_value} / target {flag.target_value}
                  </span>
                  <span className="text-xs font-semibold text-danger">
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
