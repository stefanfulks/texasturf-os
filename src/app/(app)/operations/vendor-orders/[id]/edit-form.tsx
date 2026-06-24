"use client";

import { useActionState } from "react";
import { updatePurchaseOrder, type FormState } from "../actions";
import {
  PRIORITY_OPTIONS, PURCHASE_TYPE_OPTIONS, PAYMENT_TERMS_OPTIONS, PAYMENT_STATUS_META,
} from "../_lib/status";
import type { PurchaseOrder } from "@/lib/db-helpers.types";
import type { ProfileLite, VendorLite, ProjectLite } from "../_lib/queries";

const initial: FormState = { error: null, success: false };
const field = "field-input";

function L({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-ink-3 mb-1">{children}</label>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-5">
      <h3 className="text-sm font-semibold text-ink mb-3">{title}</h3>
      {children}
    </div>
  );
}

export function EditForm({
  order, buyers, vendors, projects, canEdit,
}: {
  order: PurchaseOrder;
  buyers: ProfileLite[];
  vendors: VendorLite[];
  projects: ProjectLite[];
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updatePurchaseOrder, initial);
  const o = order;
  const ps = PAYMENT_STATUS_META[o.payment_status];

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={o.id} />
      <fieldset disabled={!canEdit} className="space-y-5">

        {/* Request */}
        <div>
          <h3 className="text-sm font-semibold text-ink mb-3">Request</h3>
          <div className="space-y-4">
            <div>
              <L>Description <span className="text-danger">*</span></L>
              <textarea name="request_description" required defaultValue={o.request_description} rows={2} className={`${field} resize-none`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <L>Assigned buyer</L>
                <select name="assigned_buyer_id" defaultValue={o.assigned_buyer_id ?? ""} className={field}>
                  <option value="">Unassigned</option>
                  {buyers.map((b) => <option key={b.id} value={b.id}>{b.full_name || b.email}</option>)}
                </select>
              </div>
              <div>
                <L>Requested by</L>
                <input name="requested_by" defaultValue={o.requested_by ?? ""} className={field} />
              </div>
              <div>
                <L>Priority</L>
                <select name="priority" defaultValue={o.priority} className={field}>
                  {PRIORITY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <L>Purchase type</L>
                <select name="purchase_type" defaultValue={o.purchase_type} className={field}>
                  {PURCHASE_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <L>Request date</L>
                <input type="date" name="request_date" defaultValue={o.request_date ?? ""} className={field} />
              </div>
              <div>
                <L>Needed by</L>
                <input type="date" name="needed_by" defaultValue={o.needed_by ?? ""} className={field} />
              </div>
              <div>
                <L>Material needed</L>
                <input name="material_needed" defaultValue={o.material_needed ?? ""} className={field} />
              </div>
              <div>
                <L>Quantity needed</L>
                <input name="quantity_needed" defaultValue={o.quantity_needed ?? ""} className={field} />
              </div>
              <div>
                <L>Linked job</L>
                <select name="project_id" defaultValue={o.project_id ?? ""} className={field}>
                  <option value="">None</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <L>Notes</L>
              <textarea name="notes" defaultValue={o.notes ?? ""} rows={2} className={`${field} resize-none`} />
            </div>
          </div>
        </div>

        {/* Vendor */}
        <Section title="Vendor & Order">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <L>Vendor</L>
              <select name="vendor_id" defaultValue={o.vendor_id ?? ""} className={field}>
                <option value="">None</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <L>Vendor contact</L>
              <input name="vendor_contact" defaultValue={o.vendor_contact ?? ""} className={field} />
            </div>
            <div>
              <L>Quote amount</L>
              <input type="number" step="0.01" name="quote_amount" defaultValue={o.quote_amount ?? ""} className={field} />
            </div>
            <div>
              <L>Estimated cost</L>
              <input type="number" step="0.01" name="estimated_cost" defaultValue={o.estimated_cost ?? ""} className={field} />
            </div>
            <div>
              <L>Final order amount</L>
              <input type="number" step="0.01" name="final_order_amount" defaultValue={o.final_order_amount ?? ""} className={field} />
            </div>
            <div>
              <L>PO number <span className="text-ink-4">(→ Order Placed)</span></L>
              <input name="po_number" defaultValue={o.po_number ?? ""} className={field} />
            </div>
            <div>
              <L>Order date</L>
              <input type="date" name="order_date" defaultValue={o.order_date ?? ""} className={field} />
            </div>
          </div>
        </Section>

        {/* Shipping */}
        <Section title="Shipping">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <L>Carrier</L>
              <input name="carrier" defaultValue={o.carrier ?? ""} className={field} />
            </div>
            <div>
              <L>Tracking number <span className="text-ink-4">(→ In Transit)</span></L>
              <input name="tracking_number" defaultValue={o.tracking_number ?? ""} className={field} />
            </div>
            <div>
              <L>Tracking URL</L>
              <input name="tracking_url" defaultValue={o.tracking_url ?? ""} className={field} />
            </div>
            <div>
              <L>ETA</L>
              <input type="date" name="eta" defaultValue={o.eta ?? ""} className={field} />
            </div>
            <div>
              <L>Expected delivery</L>
              <input type="date" name="expected_delivery_date" defaultValue={o.expected_delivery_date ?? ""} className={field} />
            </div>
            <div>
              <L>Actual delivery <span className="text-ink-4">(→ Delivered)</span></L>
              <input type="date" name="actual_delivery_date" defaultValue={o.actual_delivery_date ?? ""} className={field} />
            </div>
          </div>
        </Section>

        {/* Receiving */}
        <Section title="Receiving">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <L>Received by</L>
              <input name="received_by" defaultValue={o.received_by ?? ""} className={field} />
            </div>
            <div>
              <L>Quantity received</L>
              <input name="quantity_received" defaultValue={o.quantity_received ?? ""} className={field} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" name="shortages_reported" defaultChecked={o.shortages_reported} className="h-4 w-4" /> Shortages reported
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" name="damage_reported" defaultChecked={o.damage_reported} className="h-4 w-4" /> Damage reported
            </label>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <L>Shortage notes</L>
              <input name="shortage_notes" defaultValue={o.shortage_notes ?? ""} className={field} />
            </div>
            <div>
              <L>Damage notes</L>
              <input name="damage_notes" defaultValue={o.damage_notes ?? ""} className={field} />
            </div>
          </div>
        </Section>

        {/* Payment */}
        <Section title="Payment">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-ink-3">Payment status (auto):</span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${ps.badge}`}>{ps.label}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <L>Payment terms</L>
              <select name="payment_terms" defaultValue={o.payment_terms ?? ""} className={field}>
                <option value="">—</option>
                {PAYMENT_TERMS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-ink-2 pb-2">
                <input type="checkbox" name="deposit_required" defaultChecked={o.deposit_required} className="h-4 w-4" /> Deposit required
              </label>
            </div>
            <div>
              <L>Deposit amount</L>
              <input type="number" step="0.01" name="deposit_amount" defaultValue={o.deposit_amount ?? ""} className={field} />
            </div>
            <div>
              <L>Deposit paid date</L>
              <input type="date" name="deposit_paid_date" defaultValue={o.deposit_paid_date ?? ""} className={field} />
            </div>
            <div>
              <L>Remaining balance <span className="text-ink-4">($0 → Closed)</span></L>
              <input type="number" step="0.01" name="remaining_balance" defaultValue={o.remaining_balance ?? ""} className={field} />
            </div>
            <div>
              <L>Invoice date</L>
              <input type="date" name="invoice_date" defaultValue={o.invoice_date ?? ""} className={field} />
            </div>
            <div>
              <L>Payment due date</L>
              <input type="date" name="payment_due_date" defaultValue={o.payment_due_date ?? ""} className={field} />
            </div>
          </div>
        </Section>
      </fieldset>

      {state.error && <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">{state.error}</p>}
      {state.success && <p className="text-sm text-brand bg-brand-tint border border-brand/30 rounded-lg px-3 py-2">Saved.</p>}

      {canEdit && (
        <div className="flex justify-end sticky bottom-4">
          <button type="submit" disabled={isPending} className="btn btn-primary shadow-pop disabled:opacity-50">
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </form>
  );
}
