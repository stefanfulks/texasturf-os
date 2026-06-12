"use client";

import { useActionState } from "react";
import { changeInvoiceStatus, type ChangeStatusState } from "../../actions";

const initial: ChangeStatusState = { error: null, success: false };
const field = "w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white";

const PAYMENT_METHODS = ["Check","ACH","Wire","Zelle","Cash","Credit Card","Other"];

export function ApprovalForm({ invoiceId, currentStatus }: { invoiceId: string; currentStatus: string }) {
  const [state, formAction, isPending] = useActionState(changeInvoiceStatus, initial);
  const isPaid = currentStatus === "paid";

  return (
    <form action={formAction} className="rounded-xl border border-line bg-white p-6 space-y-5">
      <h2 className="text-sm font-semibold">Decision</h2>
      <input type="hidden" name="invoice_id" value={invoiceId} />

      {/* Big action buttons */}
      <div className="grid grid-cols-2 gap-3">
        {!isPaid && (
          <>
            <button
              type="submit"
              name="new_status"
              value="approved"
              disabled={isPending}
              className="py-4 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand disabled:opacity-50 transition-colors"
            >
              ✅ Approve
            </button>
            <button
              type="submit"
              name="new_status"
              value="paid"
              disabled={isPending}
              className="py-4 rounded-xl bg-brand text-white font-semibold text-sm hover:bg-brand disabled:opacity-50 transition-colors"
            >
              💵 Mark Paid
            </button>
          </>
        )}
        <button
          type="submit"
          name="new_status"
          value="request_change"
          disabled={isPending}
          className="py-4 rounded-xl border border-warn/30 bg-warn-tint text-warn font-semibold text-sm hover:bg-warn-tint disabled:opacity-50 transition-colors"
        >
          ✏️ Request Changes
        </button>
        <button
          type="submit"
          name="new_status"
          value="rejected"
          disabled={isPending}
          className="py-4 rounded-xl border border-danger/30 bg-danger-tint text-danger font-semibold text-sm hover:bg-danger-tint disabled:opacity-50 transition-colors"
        >
          ❌ Reject
        </button>
        <button
          type="submit"
          name="new_status"
          value="on_hold"
          disabled={isPending}
          className="py-4 rounded-xl border border-line-strong bg-hover text-ink-2 font-semibold text-sm hover:bg-sunken disabled:opacity-50 transition-colors"
        >
          🔒 On Hold
        </button>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Ownership Notes</label>
        <textarea name="ownership_notes" rows={2} placeholder="Notes for the record…" className={`${field} resize-none`} />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Change Request Reason (if requesting changes)</label>
        <textarea name="change_request_reason" rows={2} placeholder="What needs to be fixed…" className={`${field} resize-none`} />
      </div>

      {/* Payment details (shown when marking paid) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Payment Method</label>
          <select name="payment_method" defaultValue="" className={field}>
            <option value="">Select…</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Payment Reference / Check #</label>
          <input name="payment_reference" placeholder="e.g. #1042 or ACH-2024…" className={field} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Payment Notes</label>
        <textarea name="payment_notes" rows={2} placeholder="Any payment details…" className={`${field} resize-none`} />
      </div>

      {state.error && <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">{state.error}</p>}
      {state.success && <p className="text-sm text-brand bg-brand-tint border border-brand/30 rounded-lg px-3 py-2">Status updated successfully.</p>}
    </form>
  );
}
