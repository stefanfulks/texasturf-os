import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { InvoiceCommentSection } from "./comment-section";
import { ArchiveButton } from "./archive-button";
import type { Invoice, InvoiceStatus, InvoiceLineItem, InvoiceStatusHistory, InvoiceComment, Vendor } from "@/lib/db-helpers.types";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; badge: string; dot: string }> = {
  draft:              { label: "Draft",             badge: "bg-sunken text-ink-3",     dot: "bg-line-strong"    },
  submitted:          { label: "Submitted",         badge: "bg-info-tint text-info",     dot: "bg-info"    },
  ocr_processing:     { label: "Processing OCR",    badge: "bg-info-tint text-info", dot: "bg-info"  },
  ocr_review_needed:  { label: "OCR Review Needed", badge: "bg-warn-tint text-warn",   dot: "bg-warn"   },
  awaiting_review:    { label: "Awaiting Review",   badge: "bg-warn-tint text-warn", dot: "bg-warn"  },
  awaiting_approval:  { label: "Awaiting Approval", badge: "bg-warn-tint text-warn", dot: "bg-warn"  },
  approved:           { label: "Approved",          badge: "bg-brand-tint text-brand",   dot: "bg-brand"   },
  request_change:     { label: "Needs Changes",     badge: "bg-danger-tint text-danger",       dot: "bg-danger"     },
  rejected:           { label: "Rejected",          badge: "bg-danger-tint text-danger",       dot: "bg-danger"     },
  on_hold:            { label: "On Hold",           badge: "bg-sunken text-ink-3",     dot: "bg-ink-4"    },
  paid:               { label: "Paid",              badge: "bg-brand-tint text-brand", dot: "bg-brand" },
  archived:           { label: "Archived",          badge: "bg-hover text-ink-4",      dot: "bg-line"    },
};

const VARIANCE_CONFIG: Record<string, { label: string; color: string }> = {
  not_reviewed:     { label: "Not Reviewed", color: "text-ink-4"  },
  matches_expected: { label: "Matches",      color: "text-brand" },
  overcharged:      { label: "Overcharged",  color: "text-danger"   },
  undercharged:     { label: "Under",        color: "text-info"  },
  unclear:          { label: "Unclear",      color: "text-warn" },
  needs_review:     { label: "Review",       color: "text-warn"},
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isOfficeOrAdmin = profile?.role === "admin" || profile?.role === "office";

  const [invoiceRes, lineItemsRes, historyRaw, commentsRaw] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_line_items").select("*").eq("invoice_id", id).order("sort_order"),
    supabase.from("invoice_status_history").select("*, changed_by:changed_by_id(full_name, email)").eq("invoice_id", id).order("created_at", { ascending: false }),
    supabase.from("invoice_comments").select("*, user:user_id(full_name, email)").eq("invoice_id", id).order("created_at"),
  ]);

  if (!invoiceRes.data) notFound();
  const invBase = invoiceRes.data as unknown as Invoice;

  // Fetch person joins separately (avoids multi-FK TypeScript inference issue)
  const [vendorRes, submittedByRes, approvedByRes, paidByRes] = await Promise.all([
    invBase.vendor_id       ? supabase.from("vendors").select("*").eq("id", invBase.vendor_id).single() : Promise.resolve({ data: null }),
    invBase.submitted_by_id ? supabase.from("profiles").select("full_name, email").eq("id", invBase.submitted_by_id).single() : Promise.resolve({ data: null }),
    invBase.approved_by_id  ? supabase.from("profiles").select("full_name, email").eq("id", invBase.approved_by_id).single()  : Promise.resolve({ data: null }),
    invBase.paid_by_id      ? supabase.from("profiles").select("full_name, email").eq("id", invBase.paid_by_id).single()      : Promise.resolve({ data: null }),
  ]);

  const invoice = {
    ...invBase,
    vendor:       vendorRes.data       as Vendor | null,
    submitted_by: submittedByRes.data  as { full_name: string | null; email: string } | null,
    approved_by:  approvedByRes.data   as { full_name: string | null; email: string } | null,
    paid_by:      paidByRes.data       as { full_name: string | null; email: string } | null,
  };
  const lineItems  = (lineItemsRes.data ?? []) as InvoiceLineItem[];
  const history    = (historyRaw.data   ?? []) as unknown as Array<InvoiceStatusHistory & { changed_by: { full_name: string | null; email: string } | null }>;
  const comments   = (commentsRaw.data  ?? []) as unknown as Array<InvoiceComment & { user: { full_name: string | null; email: string } }>;

  const statusCfg  = STATUS_CONFIG[invoice.status as InvoiceStatus];
  const canReview  = isOfficeOrAdmin && ["awaiting_review","ocr_review_needed","submitted"].includes(invoice.status);
  const canApprove = profile?.role === "admin" && invoice.status === "awaiting_approval";

  // Generate signed URL for file preview
  let signedUrl: string | null = null;
  if (invoice.original_file_url && invoice.original_file_url.includes("supabase")) {
    const path = invoice.original_file_url.split("/invoices/")[1]?.split("?")[0];
    if (path) {
      const { data } = await supabase.storage.from("invoices").createSignedUrl(path, 3600);
      signedUrl = data?.signedUrl ?? invoice.original_file_url;
    }
  } else {
    signedUrl = invoice.original_file_url;
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Back + Header */}
      <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">← Invoices</Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{invoice.title}</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            {invoice.vendor?.name ?? "No vendor"}
            {invoice.submitted_by && ` · Submitted by ${invoice.submitted_by.full_name ?? invoice.submitted_by.email.split("@")[0]}`}
            {" · "}{format(parseISO(invoice.submitted_at), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {invoice.total_amount != null && (
            <span className="text-2xl font-bold text-ink">
              ${invoice.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          )}
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${statusCfg.badge}`}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {(canReview || canApprove || isOfficeOrAdmin) && (
        <div className="flex gap-3 flex-wrap items-center">
          {canReview && (
            <Link href={`/invoices/${id}/review`} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-strong transition-colors">
              Review Invoice
            </Link>
          )}
          {canApprove && (
            <Link href={`/invoices/${id}/approval`} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand transition-colors">
              Approve / Reject
            </Link>
          )}
          {isOfficeOrAdmin && (
            <>
              <Link href={`/invoices/${id}/edit`} className="px-4 py-2 rounded-xl border border-line-strong bg-white text-sm font-semibold text-ink-2 hover:border-line-strong transition-colors">
                Edit
              </Link>
              <ArchiveButton invoiceId={id} archived={invoice.status === "archived"} />
            </>
          )}
        </div>
      )}

      {/* Change request banner */}
      {invoice.status === "request_change" && invoice.change_request_reason && (
        <div className="rounded-xl border border-danger/30 bg-danger-tint px-5 py-4">
          <p className="text-sm font-semibold text-danger mb-1">Changes Requested</p>
          <p className="text-sm text-danger">{invoice.change_request_reason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column — 3/5 */}
        <div className="lg:col-span-3 space-y-6">

          {/* Original file preview */}
          {signedUrl && (
            <div className="rounded-xl border border-line bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-line">
                <h2 className="text-sm font-semibold">Original Invoice</h2>
              </div>
              <div className="p-4">
                {invoice.original_file_type?.startsWith("image/") ? (
                  // signedUrl is a time-limited Supabase Storage URL; unoptimized
                  // avoids the need to whitelist the dynamic host in
                  // next.config.ts (signed URLs rotate per request).
                  <Image
                    src={signedUrl}
                    alt="Invoice"
                    width={1200}
                    height={1600}
                    unoptimized
                    className="h-auto max-w-full rounded-lg"
                  />
                ) : invoice.original_file_type === "application/pdf" ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <svg className="w-10 h-10 text-ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <p className="text-sm text-ink-2">{invoice.original_file_name ?? "Invoice PDF"}</p>
                    <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-info hover:underline">Open PDF →</a>
                  </div>
                ) : (
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-info hover:underline">
                    {invoice.original_file_name ?? "Download file"}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Extracted invoice data */}
          <div className="rounded-xl border border-line bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-line">
              <h2 className="text-sm font-semibold">Invoice Details</h2>
              {invoice.ocr_confidence != null && (
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${invoice.ocr_confidence >= 85 ? "bg-brand-tint text-brand" : "bg-warn-tint text-warn"}`}>
                  {invoice.ocr_confidence.toFixed(0)}% confidence
                </span>
              )}
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                { label: "Invoice #",       value: invoice.invoice_number },
                { label: "Invoice Date",    value: invoice.invoice_date ? format(parseISO(invoice.invoice_date), "MMM d, yyyy") : null },
                { label: "Vendor",          value: invoice.vendor?.name },
                { label: "Customer",        value: invoice.customer_name },
                { label: "Job Name",        value: invoice.job_name },
                { label: "Service Start",   value: invoice.service_period_start ? format(parseISO(invoice.service_period_start), "MMM d, yyyy") : null },
                { label: "Service End",     value: invoice.service_period_end   ? format(parseISO(invoice.service_period_end),   "MMM d, yyyy") : null },
                { label: "Approval Due",    value: invoice.approval_deadline ? format(parseISO(invoice.approval_deadline), "MMM d, yyyy") : null },
                { label: "Subtotal",        value: invoice.subtotal != null ? `$${invoice.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : null },
                { label: "Tax",             value: invoice.tax != null ? `$${invoice.tax.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : null },
                { label: "Total",           value: invoice.total_amount != null ? `$${invoice.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : null },
              ].filter((f) => f.value).map((f) => (
                <div key={f.label} className="flex gap-2">
                  <span className="text-ink-4 w-32 flex-shrink-0">{f.label}</span>
                  <span className="text-ink font-medium">{f.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Line items */}
          {lineItems.length > 0 && (
            <div className="rounded-xl border border-line bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-line">
                <h2 className="text-sm font-semibold">Line Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-hover text-ink-3 text-xs">
                      <th className="text-left px-5 py-2 font-medium">Description</th>
                      <th className="text-right px-3 py-2 font-medium">Qty</th>
                      <th className="text-right px-3 py-2 font-medium">Unit Price</th>
                      <th className="text-right px-5 py-2 font-medium">Total</th>
                      {isOfficeOrAdmin && <th className="text-left px-3 py-2 font-medium">Variance</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-ink">{item.description}</p>
                          {item.category && <p className="text-xs text-ink-4">{item.category}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-ink-2">
                          {item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-ink-2">
                          {item.unit_price != null ? `$${item.unit_price.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right font-semibold text-ink">
                          ${item.line_total.toFixed(2)}
                        </td>
                        {isOfficeOrAdmin && (
                          <td className="px-3 py-2.5">
                            <span className={`text-xs font-medium ${VARIANCE_CONFIG[item.variance_status]?.color ?? "text-ink-4"}`}>
                              {VARIANCE_CONFIG[item.variance_status]?.label ?? item.variance_status}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-hover">
                      <td colSpan={isOfficeOrAdmin ? 3 : 2} className="px-5 py-2.5 text-sm font-semibold text-ink-2">Total</td>
                      <td className="px-5 py-2.5 text-right text-sm font-bold text-ink">
                        ${lineItems.reduce((s, i) => s + i.line_total, 0).toFixed(2)}
                      </td>
                      {isOfficeOrAdmin && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Comments */}
          <InvoiceCommentSection
            invoiceId={id}
            comments={comments}
            currentUserId={user.id}
            isOfficeOrAdmin={isOfficeOrAdmin}
          />
        </div>

        {/* Right column — 2/5 */}
        <div className="lg:col-span-2 space-y-5">

          {/* Payment info */}
          {invoice.status === "paid" && (
            <div className="rounded-xl border border-brand/30 bg-brand-tint p-4 space-y-2 text-sm">
              <p className="font-semibold text-brand">Paid</p>
              {invoice.paid_at && <p className="text-brand">{format(parseISO(invoice.paid_at), "MMM d, yyyy")}</p>}
              {invoice.payment_method    && <p className="text-brand">Method: {invoice.payment_method}</p>}
              {invoice.payment_reference && <p className="text-brand">Ref: {invoice.payment_reference}</p>}
              {invoice.paid_by           && <p className="text-brand">By: {invoice.paid_by.full_name ?? invoice.paid_by.email.split("@")[0]}</p>}
            </div>
          )}

          {/* Notes (office visible) */}
          {isOfficeOrAdmin && (invoice.admin_notes || invoice.variance_notes || invoice.ownership_notes || invoice.payment_notes) && (
            <div className="rounded-xl border border-line bg-white p-4 space-y-3 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-4">Notes</h3>
              {invoice.admin_notes      && <div><p className="text-xs text-ink-4 mb-0.5">Admin</p><p className="text-ink-2">{invoice.admin_notes}</p></div>}
              {invoice.variance_notes   && <div><p className="text-xs text-ink-4 mb-0.5">Variance</p><p className="text-ink-2">{invoice.variance_notes}</p></div>}
              {invoice.ownership_notes  && <div><p className="text-xs text-ink-4 mb-0.5">Ownership</p><p className="text-ink-2">{invoice.ownership_notes}</p></div>}
              {invoice.payment_notes    && <div><p className="text-xs text-ink-4 mb-0.5">Payment</p><p className="text-ink-2">{invoice.payment_notes}</p></div>}
            </div>
          )}

          {/* OCR text */}
          {isOfficeOrAdmin && invoice.ocr_text && (
            <details className="rounded-xl border border-line bg-white overflow-hidden">
              <summary className="px-4 py-3 text-sm font-semibold cursor-pointer">Raw OCR Text</summary>
              <pre className="px-4 pb-4 text-xs text-ink-3 whitespace-pre-wrap overflow-x-auto">{invoice.ocr_text}</pre>
            </details>
          )}

          {/* Status history */}
          <div className="rounded-xl border border-line bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-line">
              <h3 className="text-sm font-semibold">Status History</h3>
            </div>
            <div className="p-4 space-y-3">
              {history.map((entry, i) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${STATUS_CONFIG[entry.new_status as InvoiceStatus]?.dot ?? "bg-line-strong"}`} />
                    {i < history.length - 1 && <div className="w-px flex-1 bg-line my-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-xs font-semibold text-ink-2">
                      {STATUS_CONFIG[entry.new_status as InvoiceStatus]?.label ?? entry.new_status}
                    </p>
                    <p className="text-xs text-ink-4">
                      {entry.changed_by?.full_name ?? entry.changed_by?.email?.split("@")[0] ?? "System"}
                      {" · "}{format(parseISO(entry.created_at), "MMM d, h:mm a")}
                    </p>
                    {entry.notes && <p className="text-xs text-ink-3 mt-0.5 italic">{entry.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Integration links */}
          {isOfficeOrAdmin && invoice.monday_item_id && (
            <div className="rounded-xl border border-line bg-white p-4 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-2">Integrations</h3>
              <a
                href={`https://texasturfusa.monday.com/boards/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                Monday.com item #{invoice.monday_item_id}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
