import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { VendorForm } from "../vendor-form";
import type { Vendor, Invoice, InvoiceStatus } from "@/lib/database.types";

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
    supabase.from("invoices").select("id, title, status, total_amount, submitted_at, service_period_start, service_period_end").eq("vendor_id", id).order("submitted_at", { ascending: false }),
  ]);

  if (!vendorRes.data) notFound();

  const vendor   = vendorRes.data as Vendor;
  const invoices = (invoicesRes.data ?? []) as Invoice[];

  const totalPaid     = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const totalUnpaid   = invoices.filter((i) => !["paid","archived"].includes(i.status)).reduce((s, i) => s + (i.total_amount ?? 0), 0);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/vendors" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">← Vendors</Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{vendor.name}</h1>
          <p className="text-sm text-zinc-500">{vendor.contact_name}{vendor.email ? ` · ${vendor.email}` : ""}{vendor.phone ? ` · ${vendor.phone}` : ""}</p>
        </div>
        {!vendor.active && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">Inactive</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400">Total Invoices</p>
          <p className="text-xl font-semibold">{invoices.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400">Total Paid</p>
          <p className="text-xl font-semibold text-emerald-700">${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs text-zinc-400">Open Balance</p>
          <p className={`text-xl font-semibold ${totalUnpaid > 0 ? "text-amber-600" : "text-zinc-400"}`}>
            ${totalUnpaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
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
