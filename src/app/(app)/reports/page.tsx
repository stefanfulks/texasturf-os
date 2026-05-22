import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, Vendor, Budget, KpiEntry } from "@/lib/database.types";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function monthName(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function prevPeriod(month: number, year: number) {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

function nextPeriod(month: number, year: number) {
  if (month === 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

function daysBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24);
}

const CATEGORIES = ["subcontractors", "materials", "labor", "overhead", "equipment", "other"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  subcontractors: "Subcontractors",
  materials: "Materials",
  labor: "Labor",
  overhead: "Overhead",
  equipment: "Equipment",
  other: "Other",
};

// Map vendor_type to budget category (best-effort)
const VENDOR_TYPE_TO_CATEGORY: Record<string, Category> = {
  installer: "labor",
  contractor_1099: "subcontractors",
  subcontractor: "subcontractors",
  supplier: "materials",
  other: "other",
};

const OPEN_STATUSES = [
  "submitted",
  "ocr_review_needed",
  "awaiting_review",
  "awaiting_approval",
  "approved",
  "request_change",
  "on_hold",
] as const;

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  ocr_review_needed: "OCR Review",
  awaiting_review: "Awaiting Review",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  request_change: "Needs Changes",
  on_hold: "On Hold",
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { month: monthParam, year: yearParam } = await searchParams;

  const now = new Date();
  const month = Math.min(12, Math.max(1, parseInt(monthParam ?? "") || now.getMonth() + 1));
  const year = Math.max(2020, parseInt(yearParam ?? "") || now.getFullYear());

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "field") {
    redirect("/");
  }

  // Period boundaries
  const periodStart = new Date(year, month - 1, 1).toISOString();
  const periodEnd = new Date(year, month, 1).toISOString();

  // ── Fetch all data in parallel ──────────────────────────────
  const [
    invoicesResult,
    budgetsResult,
    kpiResult,
    openInvoicesResult,
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, status, total_amount, submitted_at, approved_at, paid_at, vendor_id")
      .gte("submitted_at", periodStart)
      .lt("submitted_at", periodEnd),
    supabase
      .from("budgets")
      .select("*")
      .eq("period_month", month)
      .eq("period_year", year),
    supabase
      .from("kpi_entries")
      .select("*")
      .eq("period_month", month)
      .eq("period_year", year),
    supabase
      .from("invoices")
      .select("id, status, vendor_id, total_amount")
      .in("status", [...OPEN_STATUSES])
      .neq("archived", true),
  ]);

  const periodInvoices = (invoicesResult.data ?? []) as Pick<
    Invoice,
    "id" | "status" | "total_amount" | "submitted_at" | "approved_at" | "paid_at" | "vendor_id"
  >[];
  const budgets = (budgetsResult.data ?? []) as Budget[];
  const kpiEntries = (kpiResult.data ?? []) as KpiEntry[];
  const openInvoices = (openInvoicesResult.data ?? []) as Pick<
    Invoice,
    "id" | "status" | "vendor_id" | "total_amount"
  >[];

  // Fetch vendors for period invoices
  const vendorIds = [...new Set(periodInvoices.map((i) => i.vendor_id).filter(Boolean))] as string[];
  let vendorMap = new Map<string, Vendor>();
  if (vendorIds.length > 0) {
    const { data: vendorsData } = await supabase.from("vendors").select("id, name, type").in("id", vendorIds);
    if (vendorsData) {
      for (const v of vendorsData as unknown as Pick<Vendor, "id" | "name" | "type">[]) {
        vendorMap.set(v.id, v as unknown as Vendor);
      }
    }
  }

  // ── Calculations ────────────────────────────────────────────

  const totalSubmitted = periodInvoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const submittedCount = periodInvoices.length;

  const approvedInvoices = periodInvoices.filter((i) => i.status === "approved" || i.status === "paid");
  const totalApproved = approvedInvoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const approvedCount = approvedInvoices.length;

  const paidInvoices = periodInvoices.filter((i) => i.status === "paid");
  const totalPaid = paidInvoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const paidCount = paidInvoices.length;

  // Avg approval days
  const withApproval = periodInvoices.filter((i) => i.approved_at && i.submitted_at);
  const avgApprovalDays =
    withApproval.length > 0
      ? withApproval.reduce((s, i) => s + daysBetween(i.submitted_at!, i.approved_at!), 0) / withApproval.length
      : null;

  // Avg payment days
  const withPayment = periodInvoices.filter((i) => i.paid_at && i.submitted_at);
  const avgPaymentDays =
    withPayment.length > 0
      ? withPayment.reduce((s, i) => s + daysBetween(i.submitted_at!, i.paid_at!), 0) / withPayment.length
      : null;

  // Spend by vendor category
  const spendByCategory: Record<Category, number> = {
    subcontractors: 0,
    materials: 0,
    labor: 0,
    overhead: 0,
    equipment: 0,
    other: 0,
  };
  for (const inv of periodInvoices) {
    if (!inv.vendor_id || !inv.total_amount) continue;
    const vendor = vendorMap.get(inv.vendor_id);
    const cat = vendor ? (VENDOR_TYPE_TO_CATEGORY[vendor.type] ?? "other") : "other";
    spendByCategory[cat] = (spendByCategory[cat] ?? 0) + inv.total_amount;
  }

  // Top vendors
  const vendorTotals = new Map<string, { vendorId: string; name: string; type: string; count: number; total: number }>();
  for (const inv of periodInvoices) {
    if (!inv.vendor_id) continue;
    const vendor = vendorMap.get(inv.vendor_id);
    const existing = vendorTotals.get(inv.vendor_id);
    if (existing) {
      existing.count += 1;
      existing.total += inv.total_amount ?? 0;
    } else {
      vendorTotals.set(inv.vendor_id, {
        vendorId: inv.vendor_id,
        name: vendor?.name ?? "Unknown",
        type: vendor?.type ?? "other",
        count: 1,
        total: inv.total_amount ?? 0,
      });
    }
  }
  const topVendors = [...vendorTotals.values()].sort((a, b) => b.total - a.total).slice(0, 5);

  // Open invoice pipeline counts
  const pipelineCounts: Record<string, number> = {};
  for (const inv of openInvoices) {
    pipelineCounts[inv.status] = (pipelineCounts[inv.status] ?? 0) + 1;
  }

  // Budget map
  const budgetMap = new Map<string, Budget>();
  for (const b of budgets) budgetMap.set(b.category, b);

  // Period nav
  const prev = prevPeriod(month, year);
  const next = nextPeriod(month, year);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Reports</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/reports?month=${prev.month}&year=${prev.year}`}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors"
          >
            &larr; Prev
          </Link>
          <span className="font-semibold text-zinc-900 min-w-[110px] text-center">
            {monthName(month, year)}
          </span>
          <Link
            href={`/reports?month=${next.month}&year=${next.year}`}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors"
          >
            Next &rarr;
          </Link>
        </div>
      </div>

      {/* Section 1 — Financial Overview */}
      <section>
        <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
          Financial Overview
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Total Submitted</p>
            <p className="text-2xl font-bold text-zinc-900">${fmt(totalSubmitted)}</p>
            <p className="text-xs text-zinc-400 mt-1">{submittedCount} invoice{submittedCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-green-50 p-5">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">Total Approved</p>
            <p className="text-2xl font-bold text-green-800">${fmt(totalApproved)}</p>
            <p className="text-xs text-green-600 mt-1">{approvedCount} invoice{approvedCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-emerald-50 p-5">
            <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-800">${fmt(totalPaid)}</p>
            <p className="text-xs text-emerald-600 mt-1">{paidCount} invoice{paidCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Avg Approval Time</p>
            <p className="text-2xl font-bold text-zinc-900">
              {avgApprovalDays !== null ? `${avgApprovalDays.toFixed(1)} days` : "—"}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {avgPaymentDays !== null ? `${avgPaymentDays.toFixed(1)} days to pay` : "No payments this period"}
            </p>
          </div>
        </div>
      </section>

      {/* Section 2 — Budget vs Actual */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Budget vs Actual</p>
          <Link
            href={`/reports/budget?month=${month}&year=${year}`}
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium"
          >
            Edit Budget &rarr;
          </Link>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          {budgets.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-zinc-400 mb-3">No budget set for this period.</p>
              <Link
                href={`/reports/budget?month=${month}&year=${year}`}
                className="text-sm font-semibold text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
              >
                Set budget for {monthName(month, year)}
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Category</th>
                  <th className="text-right px-4 py-3 font-semibold text-zinc-600">Budget</th>
                  <th className="text-right px-4 py-3 font-semibold text-zinc-600">Actual</th>
                  <th className="text-right px-4 py-3 font-semibold text-zinc-600">Variance</th>
                  <th className="text-right px-4 py-3 font-semibold text-zinc-600">% Used</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((cat) => {
                  const budget = budgetMap.get(cat);
                  const budgeted = budget?.budgeted_amount ?? 0;
                  const actual = spendByCategory[cat] ?? 0;
                  const variance = actual - budgeted;
                  const pctUsed = budgeted > 0 ? (actual / budgeted) * 100 : null;
                  return (
                    <tr key={cat} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-zinc-700 font-medium">{CATEGORY_LABELS[cat]}</td>
                      <td className="px-4 py-3 text-right text-zinc-600">${fmt(budgeted)}</td>
                      <td className="px-4 py-3 text-right text-zinc-800 font-medium">${fmt(actual)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${variance > 0 ? "text-red-600" : "text-green-700"}`}>
                        {variance > 0 ? "+" : ""}{fmt(variance)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500">
                        {pctUsed !== null ? `${pctUsed.toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                  <td className="px-4 py-3 font-bold text-zinc-800">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-zinc-800">
                    ${fmt(budgets.reduce((s, b) => s + (b.budgeted_amount ?? 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-zinc-800">
                    ${fmt(CATEGORIES.reduce((s, c) => s + (spendByCategory[c] ?? 0), 0))}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${
                    CATEGORIES.reduce((s, c) => s + (spendByCategory[c] ?? 0), 0) -
                    budgets.reduce((s, b) => s + (b.budgeted_amount ?? 0), 0) > 0
                      ? "text-red-600"
                      : "text-green-700"
                  }`}>
                    {(() => {
                      const v =
                        CATEGORIES.reduce((s, c) => s + (spendByCategory[c] ?? 0), 0) -
                        budgets.reduce((s, b) => s + (b.budgeted_amount ?? 0), 0);
                      return `${v > 0 ? "+" : ""}${fmt(v)}`;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500">
                    {(() => {
                      const totalBudgeted = budgets.reduce((s, b) => s + (b.budgeted_amount ?? 0), 0);
                      const totalActual = CATEGORIES.reduce((s, c) => s + (spendByCategory[c] ?? 0), 0);
                      return totalBudgeted > 0 ? `${((totalActual / totalBudgeted) * 100).toFixed(0)}%` : "—";
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>

      {/* Section 3 — Invoice Pipeline */}
      <section>
        <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
          Open Invoice Pipeline
        </p>
        <div className="flex flex-wrap gap-2">
          {OPEN_STATUSES.map((status) => {
            const count = pipelineCounts[status] ?? 0;
            if (count === 0) return null;
            return (
              <Link
                key={status}
                href={`/invoices?status=${STATUS_LABELS[status]}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors text-sm font-medium text-zinc-700"
              >
                {STATUS_LABELS[status]}
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-900 text-white text-xs font-bold">
                  {count}
                </span>
              </Link>
            );
          })}
          {OPEN_STATUSES.every((s) => !pipelineCounts[s]) && (
            <p className="text-sm text-zinc-400">No open invoices.</p>
          )}
        </div>
      </section>

      {/* Section 4 — Top Vendors */}
      <section>
        <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
          Top Vendors This Period
        </p>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          {topVendors.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-zinc-400">No invoices this period.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Vendor</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Type</th>
                  <th className="text-right px-4 py-3 font-semibold text-zinc-600">Invoices</th>
                  <th className="text-right px-4 py-3 font-semibold text-zinc-600">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {topVendors.map((v) => (
                  <tr key={v.vendorId} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 font-medium text-zinc-800">{v.name}</td>
                    <td className="px-4 py-3 text-zinc-500 capitalize">{v.type.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-right text-zinc-600">{v.count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-800">${fmt(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Section 5 — KPI Tracking */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">KPI Tracking</p>
          <Link
            href={`/reports/kpis?month=${month}&year=${year}`}
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium"
          >
            Edit KPIs &rarr;
          </Link>
        </div>
        {kpiEntries.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
            <p className="text-sm text-zinc-400 mb-3">No KPIs entered for this period.</p>
            <Link
              href={`/reports/kpis?month=${month}&year=${year}`}
              className="text-sm font-semibold text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
            >
              Add KPIs for {monthName(month, year)}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {kpiEntries.map((kpi) => {
              const actual = kpi.actual_value;
              const target = kpi.target_value;
              let indicatorClass = "text-zinc-400";
              if (actual !== null && target !== null && target !== 0) {
                const ratio = actual / target;
                if (ratio >= 1) indicatorClass = "text-green-700";
                else if (ratio >= 0.9) indicatorClass = "text-amber-600";
                else indicatorClass = "text-red-600";
              }
              return (
                <div key={kpi.id} className="rounded-xl border border-zinc-200 bg-white p-5">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 truncate">
                    {kpi.kpi_label}
                  </p>
                  <p className={`text-2xl font-bold ${indicatorClass}`}>
                    {actual !== null ? actual.toLocaleString("en-US") : "—"}
                    {kpi.unit && <span className="text-sm font-normal text-zinc-400 ml-1">{kpi.unit}</span>}
                  </p>
                  {target !== null && (
                    <p className="text-xs text-zinc-400 mt-1">
                      Target: {target.toLocaleString("en-US")}{kpi.unit ? ` ${kpi.unit}` : ""}
                    </p>
                  )}
                  {kpi.notes && (
                    <p className="text-xs text-zinc-400 mt-1 italic truncate">{kpi.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
