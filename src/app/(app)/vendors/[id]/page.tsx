import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { VendorForm } from "../vendor-form";
import { VendorArchiveButton } from "./archive-button";
import type { Vendor, Invoice, InvoiceStatus } from "@/lib/db-helpers.types";

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft:             "bg-zinc-100 text-zinc-500",
  submitted:         "bg-blue-50 text-blue-700",
  ocr_processing:    "bg-indigo-50 text-indigo-700",
  ocr_review_needed: "bg-amber-50 text-amber-700",
  awaiting_review:   "bg-yellow-50 text-yellow-700",
  awaiting_approval: "bg-orange-50 text-orange-700",
  approved:          "bg-green-50 text-green-700",
  request_change:    "bg-red-50 text-red-700",
  rejected:          "bg-red-100 text-red-800",
  on_hold:           "bg-zinc-100 text-zinc-500",
  paid:              "bg-emerald-50 text-emerald-700",
  archived:          "bg-zinc-50 text-zinc-400",
};

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isOfficeOrAdmin = ["admin","office"].includes(profile?.role ?? "");

  const [vendorRes, invoicesRes] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", id).single(),
    supabase.from("invoices")
      .select("id, title, status, total_amount, submitted_at, approved_at, paid_at, service_period_start, service_period_end")
      .eq("vendor_id", id)
      .order("submitted_at", { ascending: false }),
  ]);

  if (!vendorRes.data) notFound();

  const vendor   = vendorRes.data as Vendor;
  const invoices = (invoicesRes.data ?? []) as Invoice[];

  // ── Scorecard calculations ───────────────────────────────────
  const paidInvoices     = invoices.filter((i) => i.status === "paid");
  const activeInvoices   = invoices.filter((i) => !["archived"].includes(i.status));
  const totalPaid        = paidInvoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const totalUnpaid      = invoices.filter((i) => !["paid","archived"].includes(i.status)).reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const totalAllTime     = activeInvoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const avgInvoiceAmount = activeInvoices.length > 0 ? totalAllTime / activeInvoices.length : null;

  const withPayment = paidInvoices.filter((i) => i.paid_at && i.submitted_at);
  const avgDaysToPayment = withPayment.length > 0
    ? withPayment.reduce((s, i) => s + (new Date(i.paid_at!).getTime() - new Date(i.submitted_at).getTime()) / 86400000, 0) / withPayment.length
    : null;

  const withApproval = invoices.filter((i) => i.approved_at && i.submitted_at);
  const avgDaysToApproval = withApproval.length > 0
    ? withApproval.reduce((s, i) => s + (new Date(i.approved_at!).getTime() - new Date(i.submitted_at).getTime()) / 86400000, 0) / withApproval.length
    : null;

  const firstInvoiceDate = invoices.length > 0 ? invoices[invoices.length - 1].submitted_at : null;

  // Monthly trend — last 6 months
  const now = new Date();
  const months: { label: string; key: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }
  const monthlyTrend = months.map(({ label, key }) => {
    const [yr, mo] = key.split("-").map(Number);
    const monthInvoices = invoices.filter((i) => {
      const d = new Date(i.submitted_at);
      return d.getFullYear() === yr && d.getMonth() + 1 === mo;
    });
    return {
      label,
      count: monthInvoices.length,
      total: monthInvoices.reduce((s, i) => s + (i.total_amount ?? 0), 0),
      paid:  monthInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total_amount ?? 0), 0),
    };
  });

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/vendors" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">← Vendors</Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{vendor.name}</h1>
          <p className="text-sm text-zinc-500">{vendor.contact_name}{vendor.email ? ` · ${vendor.email}` : ""}{vendor.phone ? ` · ${vendor.phone}` : ""}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!vendor.active && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">Inactive</span>
          )}
          {isOfficeOrAdmin && (
            <VendorArchiveButton vendorId={vendor.id} archived={!vendor.active} />
          )}
        </div>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Total Invoices</p>
          <p className="text-xl font-semibold">{activeInvoices.length}</p>
          {firstInvoiceDate && (
            <p className="text-xs text-zinc-400 mt-1">since {format(parseISO(firstInvoiceDate), "MMM yyyy")}</p>
          )}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Total Paid</p>
          <p className="text-xl font-semibold text-emerald-700">${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-zinc-400 mt-1">{paidInvoices.length} invoice{paidInvoices.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Open Balance</p>
          <p className={`text-xl font-semibold ${totalUnpaid > 0 ? "text-amber-600" : "text-zinc-400"}`}>
            ${totalUnpaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Avg Invoice</p>
          <p className="text-xl font-semibold">
            {avgInvoiceAmount != null ? `$${avgInvoiceAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Avg Days to Approval</p>
          <p className={`text-xl font-semibold ${avgDaysToApproval != null && avgDaysToApproval > 7 ? "text-amber-600" : "text-zinc-900"}`}>
            {avgDaysToApproval != null ? `${avgDaysToApproval.toFixed(1)}d` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400 mb-1">Avg Days to Payment</p>
          <p className={`text-xl font-semibold ${avgDaysToPayment != null && avgDaysToPayment > 30 ? "text-red-600" : "text-zinc-900"}`}>
            {avgDaysToPayment != null ? `${avgDaysToPayment.toFixed(1)}d` : "—"}
          </p>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold">6-Month Trend</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Month</th>
              <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Invoices</th>
              <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Submitted</th>
              <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs uppercase tracking-wide">Paid</th>
            </tr>
          </thead>
          <tbody>
            {monthlyTrend.map((row) => (
              <tr key={row.label} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                <td className="px-4 py-2.5 text-zinc-700 font-medium">{row.label}</td>
                <td className="px-4 py-2.5 text-right text-zinc-500">{row.count > 0 ? row.count : <span className="text-zinc-300">—</span>}</td>
                <td className="px-4 py-2.5 text-right font-medium text-zinc-800">
                  {row.total > 0 ? `$${row.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : <span className="text-zinc-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-emerald-700 font-medium">
                  {row.paid > 0 ? `$${row.paid.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : <span className="text-zinc-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoice history */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold">Invoice History</h2>
          <Link href={`/invoices/new`} className="text-xs text-zinc-500 hover:text-zinc-900">+ New Invoice</Link>
        </div>
        {invoices.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400">No invoices yet.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {invoices.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 group-hover:underline truncate">{inv.title}</p>
                  <p className="text-xs text-zinc-400">
                    {format(parseISO(inv.submitted_at), "MMM d, yyyy")}
                    {inv.service_period_start && ` · ${format(parseISO(inv.service_period_start), "MMM d")}${inv.service_period_end ? `–${format(parseISO(inv.service_period_end), "d")}` : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {inv.total_amount != null && (
                    <span className="text-sm font-semibold">${inv.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[inv.status as InvoiceStatus]}`}>
                    {inv.status.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Edit form */}
      {isOfficeOrAdmin && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold mb-4">Edit Vendor</h2>
          <VendorForm mode="edit" vendor={vendor} />
        </div>
      )}
    </div>
  );
}
