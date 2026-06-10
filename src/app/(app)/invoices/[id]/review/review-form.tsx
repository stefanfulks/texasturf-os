"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateInvoiceFields, changeInvoiceStatus, type UpdateInvoiceFieldsState, type ChangeStatusState } from "../../actions";
import { upsertLineItems } from "../../actions";
import type { Invoice, InvoiceLineItem, Vendor, Project } from "@/lib/db-helpers.types";

const field = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";
const initFields: UpdateInvoiceFieldsState = { error: null, success: false };
const initStatus: ChangeStatusState = { error: null, success: false };

const VARIANCE_OPTIONS = [
  { value: "not_reviewed",     label: "Not Reviewed" },
  { value: "matches_expected", label: "Matches Expected" },
  { value: "overcharged",      label: "Overcharged" },
  { value: "undercharged",     label: "Undercharged" },
  { value: "unclear",          label: "Unclear" },
  { value: "needs_review",     label: "Needs Ownership Review" },
];

const LINE_CATEGORIES = ["labor","material","delivery","dump_fee","equipment","infill","demo","warranty","misc"];

type LineItemDraft = Omit<InvoiceLineItem, "created_at"> & { _temp?: boolean };

export function ReviewForm({
  invoice,
  lineItems: initialLineItems,
  vendors,
  projects,
}: {
  invoice: Invoice & { vendor: Vendor | null };
  lineItems: InvoiceLineItem[];
  vendors: Pick<Vendor, "id" | "name" | "type">[];
  projects: Pick<Project, "id" | "name" | "status">[];
}) {
  const router = useRouter();
  const [fieldsState, fieldsAction, fieldsIsPending] = useActionState(updateInvoiceFields, initFields);
  const [statusState, statusAction, statusIsPending] = useActionState(changeInvoiceStatus, initStatus);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(initialLineItems);
  const [savingLines, setSavingLines] = useState(false);

  function addLine() {
    setLineItems((prev) => [
      ...prev,
      {
        id:                     `temp-${Date.now()}`,
        invoice_id:             invoice.id,
        description:            "",
        normalized_description: null,
        category:               null,
        quantity:               null,
        unit:                   null,
        unit_price:             null,
        line_total:             0,
        expected_unit_price:    null,
        variance_amount:        null,
        variance_percent:       null,
        variance_status:        "not_reviewed",
        variance_reason:        null,
        sort_order:             prev.length,
        _temp:                  true,
      },
    ]);
  }

  function updateLine(idx: number, key: keyof LineItemDraft, value: unknown) {
    setLineItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [key]: value };
      // Auto-calc total
      if (key === "unit_price" || key === "quantity") {
        const qty   = key === "quantity"   ? Number(value) : (item.quantity   ?? 1);
        const price = key === "unit_price" ? Number(value) : (item.unit_price ?? 0);
        updated.line_total = qty * price;
      }
      return updated as LineItemDraft;
    }));
  }

  function removeLine(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveLines() {
    setSavingLines(true);
    await upsertLineItems(invoice.id, lineItems.map((item) => ({
      id:          item._temp ? undefined : item.id,
      description: item.description,
      category:    item.category    ?? undefined,
      quantity:    item.quantity    ?? undefined,
      unit:        item.unit        ?? undefined,
      unit_price:  item.unit_price  ?? undefined,
      line_total:  item.line_total,
    })));
    setSavingLines(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Invoice fields editor */}
      <form action={fieldsAction} className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
        <h2 className="text-sm font-semibold">Invoice Details</h2>
        <input type="hidden" name="invoice_id" value={invoice.id} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Invoice Title</label>
            <input name="title" defaultValue={invoice.title} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Invoice #</label>
            <input name="invoice_number" defaultValue={invoice.invoice_number ?? ""} className={field} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Invoice Date</label>
            <input type="date" name="invoice_date" defaultValue={invoice.invoice_date ?? ""} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Approval Deadline</label>
            <input type="date" name="approval_deadline" defaultValue={invoice.approval_deadline ?? ""} className={field} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Service Period Start</label>
            <input type="date" name="service_period_start" defaultValue={invoice.service_period_start ?? ""} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Service Period End</label>
            <input type="date" name="service_period_end" defaultValue={invoice.service_period_end ?? ""} className={field} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Subtotal</label>
            <input type="number" step="0.01" name="subtotal" defaultValue={invoice.subtotal ?? ""} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Tax</label>
            <input type="number" step="0.01" name="tax" defaultValue={invoice.tax ?? ""} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Total Amount</label>
            <input type="number" step="0.01" name="total_amount" defaultValue={invoice.total_amount ?? ""} className={field} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Customer Name</label>
            <input name="customer_name" defaultValue={invoice.customer_name ?? ""} className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Job Name</label>
            <input name="job_name" defaultValue={invoice.job_name ?? ""} className={field} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Admin Notes</label>
          <textarea name="admin_notes" rows={2} defaultValue={invoice.admin_notes ?? ""} className={`${field} resize-none`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Variance Notes</label>
          <textarea name="variance_notes" rows={2} defaultValue={invoice.variance_notes ?? ""} placeholder="e.g. Labor rate $0.25 above standard…" className={`${field} resize-none`} />
        </div>

        {fieldsState.success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Saved.</p>}
        {fieldsState.error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fieldsState.error}</p>}

        <div className="flex justify-end">
          <button type="submit" disabled={fieldsIsPending} className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50">
            {fieldsIsPending ? "Saving…" : "Save Details"}
          </button>
        </div>
      </form>

      {/* Line items editor */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-semibold">Line Items</h2>
          <button type="button" onClick={addLine} className="text-xs text-zinc-600 hover:text-zinc-900 font-medium">+ Add line</button>
        </div>

        <div className="p-4 space-y-3">
          {lineItems.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-4">No line items. Click &quot;+ Add line&quot; to start.</p>
          )}
          {lineItems.map((item, idx) => (
            <div key={item.id} className="border border-zinc-200 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  value={item.description}
                  onChange={(e) => updateLine(idx, "description", e.target.value)}
                  placeholder="Description"
                  className={`sm:col-span-2 ${field}`}
                />
                <select value={item.category ?? ""} onChange={(e) => updateLine(idx, "category", e.target.value || null)} className={field}>
                  <option value="">Category…</option>
                  {LINE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input type="number" step="0.001" value={item.quantity ?? ""} onChange={(e) => updateLine(idx, "quantity", e.target.value ? Number(e.target.value) : null)} placeholder="Qty" className={field} />
                <input value={item.unit ?? ""} onChange={(e) => updateLine(idx, "unit", e.target.value || null)} placeholder="Unit" className={field} />
                <input type="number" step="0.01" value={item.unit_price ?? ""} onChange={(e) => updateLine(idx, "unit_price", e.target.value ? Number(e.target.value) : null)} placeholder="Unit Price" className={field} />
                <input type="number" step="0.01" value={item.line_total} onChange={(e) => updateLine(idx, "line_total", Number(e.target.value))} placeholder="Total" className={field} />
              </div>
              <div className="flex items-center gap-2">
                <select value={item.variance_status} onChange={(e) => updateLine(idx, "variance_status", e.target.value)} className={`flex-1 ${field}`}>
                  {VARIANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={item.variance_reason ?? ""} onChange={(e) => updateLine(idx, "variance_reason", e.target.value || null)} placeholder="Variance reason…" className={`flex-1 ${field}`} />
                <button type="button" onClick={() => removeLine(idx)} className="text-zinc-300 hover:text-red-500 p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {lineItems.length > 0 && (
          <div className="px-5 pb-4 flex justify-between items-center">
            <span className="text-sm font-semibold text-zinc-700">
              Total: ${lineItems.reduce((s, i) => s + i.line_total, 0).toFixed(2)}
            </span>
            <button
              type="button"
              onClick={handleSaveLines}
              disabled={savingLines}
              className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
            >
              {savingLines ? "Saving…" : "Save Line Items"}
            </button>
          </div>
        )}
      </div>

      {/* Status advance */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold">Advance Status</h2>

        <form action={statusAction} className="space-y-4">
          <input type="hidden" name="invoice_id" value={invoice.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { status: "awaiting_approval", label: "✅ Send to Ownership Approval", style: "border-green-300 bg-green-50 text-green-800 hover:bg-green-100" },
              { status: "request_change",    label: "✏️ Request Changes",             style: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" },
              { status: "on_hold",           label: "🔒 Put On Hold",                 style: "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"   },
              { status: "rejected",          label: "❌ Reject",                       style: "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"       },
            ].map(({ status, label, style }) => (
              <button
                key={status}
                type="submit"
                name="new_status"
                value={status}
                disabled={statusIsPending}
                className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 ${style}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Notes (optional)</label>
            <textarea name="notes" rows={2} placeholder="Add a note about this status change…" className={`${field} resize-none`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Change Request Reason (if requesting changes)</label>
            <textarea name="change_request_reason" rows={2} placeholder="What needs to be corrected…" className={`${field} resize-none`} />
          </div>

          {statusState.error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{statusState.error}</p>}
          {statusState.success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Status updated.</p>}
        </form>
      </div>
    </div>
  );
}
