import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { ApprovalForm } from "./approval-form";
import type { Invoice, InvoiceLineItem, Vendor } from "@/lib/db-helpers.types";

export default async function InvoiceApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect(`/invoices/${id}`);

  const [invoiceRes, lineItemsRes] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_line_items").select("*").eq("invoice_id", id).order("sort_order"),
  ]);

  if (!invoiceRes.data) notFound();
  const inv = invoiceRes.data as unknown as Invoice;

  // Fetch joins separately to avoid multi-FK TypeScript inference issue
  const [vendorRes, submitterRes] = await Promise.all([
    inv.vendor_id      ? supabase.from("vendors").select("*").eq("id", inv.vendor_id).single() : Promise.resolve({ data: null }),
    inv.submitted_by_id ? supabase.from("profiles").select("full_name, email").eq("id", inv.submitted_by_id).single() : Promise.resolve({ data: null }),
  ]);

  const invoice = {
    ...inv,
    vendor:       vendorRes.data as Vendor | null,
    submitted_by: submitterRes.data as { full_name: string | null; email: string } | null,
  };
  const lineItems = (lineItemsRes.data ?? []) as InvoiceLineItem[];

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/invoices/${id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">← Invoice</Link>

      <h1 className="text-2xl font-semibold tracking-tight">Ownership Approval</h1>

      {/* Invoice summary */}
      <div className="rounded-xl border border-line bg-white p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{invoice.title}</h2>
            <p className="text-sm text-ink-3">
              {invoice.vendor?.name ?? "No vendor"}
              {invoice.submitted_by && ` · ${invoice.submitted_by.full_name ?? invoice.submitted_by.email.split("@")[0]}`}
            </p>
          </div>
          {invoice.total_amount != null && (
            <span className="text-2xl font-bold text-ink">
              ${invoice.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm pt-2 border-t border-line">
          {invoice.service_period_start && (
            <div className="flex gap-2"><span className="text-ink-4">Service</span><span>{format(parseISO(invoice.service_period_start), "MMM d")}{invoice.service_period_end ? `–${format(parseISO(invoice.service_period_end), "MMM d")}` : ""}</span></div>
          )}
          {invoice.customer_name && <div className="flex gap-2"><span className="text-ink-4">Customer</span><span>{invoice.customer_name}</span></div>}
          {invoice.job_name && <div className="flex gap-2"><span className="text-ink-4">Job</span><span>{invoice.job_name}</span></div>}
          {invoice.approval_deadline && <div className="flex gap-2"><span className="text-ink-4">Deadline</span><span>{format(parseISO(invoice.approval_deadline), "MMM d, yyyy")}</span></div>}
        </div>

        {invoice.admin_notes && (
          <div className="pt-2 border-t border-line">
            <p className="text-xs font-semibold text-ink-4 mb-1">Admin Notes</p>
            <p className="text-sm text-ink-2">{invoice.admin_notes}</p>
          </div>
        )}
        {invoice.variance_notes && (
          <div className="pt-2 border-t border-line">
            <p className="text-xs font-semibold text-warn mb-1">⚠ Variance Notes</p>
            <p className="text-sm text-ink-2">{invoice.variance_notes}</p>
          </div>
        )}
      </div>

      {/* Line items summary */}
      {lineItems.length > 0 && (
        <div className="rounded-xl border border-line bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-line">
            <h3 className="text-sm font-semibold">Line Items</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-2.5">
                    <p className="font-medium">{item.description}</p>
                    {item.category && <p className="text-xs text-ink-4">{item.category}</p>}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold">${item.line_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-hover">
                <td className="px-5 py-3 font-semibold text-ink-2">Total</td>
                <td className="px-5 py-3 text-right font-bold text-ink">
                  ${lineItems.reduce((s, i) => s + i.line_total, 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ApprovalForm invoiceId={id} currentStatus={invoice.status} />
    </div>
  );
}
