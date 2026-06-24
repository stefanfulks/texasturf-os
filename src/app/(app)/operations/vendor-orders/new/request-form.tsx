"use client";

import { useActionState } from "react";
import { createPurchaseOrder, type FormState } from "../actions";
import { PRIORITY_OPTIONS, PURCHASE_TYPE_OPTIONS } from "../_lib/status";
import type { ProfileLite, ProjectLite } from "../_lib/queries";

const initial: FormState = { error: null, success: false };
const field = "field-input";

export function RequestForm({
  buyers,
  projects,
  defaultRequestedBy,
  defaultBuyerId,
}: {
  buyers: ProfileLite[];
  projects: ProjectLite[];
  defaultRequestedBy: string;
  defaultBuyerId: string;
}) {
  const [state, formAction, isPending] = useActionState(createPurchaseOrder, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">
          What do you need? <span className="text-danger">*</span>
        </label>
        <textarea
          name="request_description"
          required
          rows={2}
          placeholder="e.g. Need another roll of Monte Carlo; running low on seam tape and nails."
          className={`${field} resize-none`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Requested by <span className="text-danger">*</span></label>
          <input name="requested_by" required defaultValue={defaultRequestedBy} placeholder="Your name" className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Priority <span className="text-danger">*</span></label>
          <select name="priority" defaultValue="normal" className={field}>
            {PRIORITY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Assigned buyer <span className="text-danger">*</span></label>
        <select name="assigned_buyer_id" required defaultValue={defaultBuyerId} className={field}>
          <option value="">Select a buyer…</option>
          {buyers.map((b) => <option key={b.id} value={b.id}>{b.full_name || b.email}</option>)}
        </select>
        <p className="mt-1 text-[11px] text-ink-4">Whoever owns getting this ordered.</p>
      </div>

      <div className="border-t border-line pt-4">
        <p className="text-xs font-semibold text-ink-3 mb-3">Optional details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Material needed</label>
            <input name="material_needed" placeholder="Monte Carlo turf" className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Quantity needed</label>
            <input name="quantity_needed" placeholder="3 pallets / 1 roll" className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Needed by</label>
            <input type="date" name="needed_by" className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1">Purchase type</label>
            <select name="purchase_type" defaultValue="inventory_replenishment" className={field}>
              {PURCHASE_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-ink-3 mb-1">Linked job <span className="text-ink-4">(if project-specific)</span></label>
          <select name="project_id" defaultValue="" className={field}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-ink-3 mb-1">Notes</label>
          <textarea name="notes" rows={2} className={`${field} resize-none`} />
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">{state.error}</p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn btn-primary disabled:opacity-50">
          {isPending ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}
