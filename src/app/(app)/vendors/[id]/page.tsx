import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { VendorForm } from "../vendor-form";
import { VendorArchiveButton } from "./archive-button";
import type { Vendor, Invoice, InvoiceStatus } from "@/lib/db-helpers.types";

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft:             "bg-sunken text-ink-3",
  submitted:         "bg-info-tint text-info",
  ocr_processing:    "bg-info-tint text-info",
  ocr_review_needed: "bg-warn-tint text-warn",
  awaiting_review:   "bg-warn-tint text-warn",
  awaiting_approval: "bg-warn-tint text-warn",
  approved:          "bg-brand-tint text-brand",
  request_change:    "bg-danger-tint text-danger",
  rejected:          "bg-danger-tint text-danger",
  on_hold:           "bg-sunken text-ink-3",
  paid:              "bg-brand-tint text-brand",
  archived:          "bg-hover text-ink-4",
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
      <Link href="/vendors" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">← Vendors</Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">{vendor.name}</h1>
          <p className="text-sm text-ink-3">{vendor.contact_name}{vendor.email ? ` · ${vendor.email}` : ""}{vendor.phone ? ` · ${vendor.phone}` : ""}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!vendor.active && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-sunken text-ink-3">Inactive</span>
          )}
          {isOfficeOrAdmin && (
            <VendorArchiveButton vendorId={vendor.id} archived={!vendor.active} />
          )}
        </div>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Total Invoices</p>
          <p className="text-xl font-semibold">{activeInvoices.length}</p>
          {firstInvoiceDate && (
            <p className="text-xs text-ink-4 mt-1">since {format(parseISO(firstInvoiceDate), "MMM yyyy")}</p>
          )}
        </div>
        <div className="rounded-xl border border-line bg-brand-tint px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Total Paid</p>
          <p className="text-xl font-semibold text-brand">${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-ink-4 mt-1">{paidInvoices.length} invoice{paidInvoices.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Open Balance</p>
          <p className={`text-xl font-semibold ${totalUnpaid > 0 ? "text-warn" : "text-ink-4"}`}>
            ${totalUnpaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Avg Invoice</p>
          <p className="text-xl font-semibold">
            {avgInvoiceAmount != null ? `$${avgInvoiceAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
          </p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Avg Days to Approval</p>
          <p className={`text-xl font-semibold ${avgDaysToApproval != null && avgDaysToApproval > 7 ? "text-warn" : "text-ink"}`}>
            {avgDaysToApproval != null ? `${avgDaysToApproval.toFixed(1)}d` : "—"}
          </p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-4 mb-1">Avg Days to Payment</p>
          <p className={`text-xl font-semibold ${avgDaysToPayment != null && avgDaysToPayment > 30 ? "text-danger" : "text-ink"}`}>
            {avgDaysToPayment != null ? `${avgDaysToPayment.toFixed(1)}d` : "—"}
          </p>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line">
          <h2 className="text-sm font-semibold">6-Month Trend</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-hover">
              <th className="text-left px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Month</th>
              <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Invoices</th>
              <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Submitted</th>
              <th className="text-right px-4 py-2.5 font-semibold text-ink-3 text-xs uppercase tracking-wide">Paid</th>
            </tr>
          </thead>
          <tbody>
            {monthlyTrend.map((row) => (
              <tr key={row.label} className="border-b border-line hover:bg-hover/50">
                <td className="px-4 py-2.5 text-ink-2 font-medium">{row.label}</td>
                <td className="px-4 py-2.5 text-right text-ink-3">{row.count > 0 ? row.count : <span className="text-ink-4">—</span>}</td>
                <td className="px-4 py-2.5 text-right font-medium text-ink">
                  {row.total > 0 ? `$${row.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : <span className="text-ink-4">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-brand font-medium">
                  {row.paid > 0 ? `$${row.paid.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : <span className="text-ink-4">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoice history */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h2 className="text-sm font-semibold">Invoice History</h2>
          <Link href={`/invoices/new`} className="text-xs text-ink-3 hover:text-ink">+ New Invoice</Link>
        </div>
        {invoices.length === 0 ? (
          <div className="empty-state">
            <span className="medallion"><FileText className="h-5 w-5" /></span>
            <p className="empty-state-title">No invoices yet</p>
            <p className="empty-state-body">Invoices from this vendor will show up here once they&rsquo;re added.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {invoices.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-hover transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink group-hover:underline truncate">{inv.title}</p>
                  <p className="text-xs text-ink-4">
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
        <div className="card p-6">
          <h2 className="text-sm font-semibold mb-4">Edit Vendor</h2>
          <VendorForm mode="edit" vendor={vendor} />
        </div>
      )}
    </div>
  );
}
