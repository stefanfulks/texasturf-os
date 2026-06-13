"use client";

import { useActionState } from "react";
import { createVendor, updateVendor, type VendorFormState } from "./actions";
import type { Vendor } from "@/lib/db-helpers.types";

const initial: VendorFormState = { error: null, success: false };
const field = "field-input";

const VENDOR_TYPES = [
  ["installer",       "Installer"],
  ["contractor_1099", "1099 Contractor"],
  ["subcontractor",   "Subcontractor"],
  ["supplier",        "Supplier"],
  ["other",           "Other"],
] as const;

export function VendorForm({ mode, vendor }: { mode: "create" | "edit"; vendor?: Vendor }) {
  const action = mode === "create" ? createVendor : updateVendor;
  const [state, formAction, isPending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-4">
      {mode === "edit" && vendor && <input type="hidden" name="id" value={vendor.id} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Name *</label>
          <input name="name" defaultValue={vendor?.name ?? ""} required placeholder="Hillcast LLC" className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Type *</label>
          <select name="type" defaultValue={vendor?.type ?? "contractor_1099"} className={field}>
            {VENDOR_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Contact Name</label>
          <input name="contact_name" defaultValue={vendor?.contact_name ?? ""} placeholder="John Smith" className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Email</label>
          <input type="email" name="email" defaultValue={vendor?.email ?? ""} placeholder="john@example.com" className={field} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Phone</label>
          <input name="phone" type="tel" inputMode="tel" defaultValue={vendor?.phone ?? ""} placeholder="(512) 555-0100" className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Payment Terms</label>
          <input name="payment_terms" defaultValue={vendor?.payment_terms ?? ""} placeholder="Net 15, on approval, etc." className={field} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Address</label>
        <input name="address" defaultValue={vendor?.address ?? ""} placeholder="Austin, TX" className={field} />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Notes</label>
        <textarea name="notes" defaultValue={vendor?.notes ?? ""} rows={2} className={`${field} resize-none`} />
      </div>

      {state.error && <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">{state.error}</p>}
      {state.success && mode === "edit" && <p className="text-sm text-brand bg-brand-tint border border-brand/30 rounded-lg px-3 py-2">Saved.</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn btn-primary disabled:opacity-50">
          {isPending ? (mode === "create" ? "Adding…" : "Saving…") : (mode === "create" ? "Add Vendor" : "Save Changes")}
        </button>
      </div>
    </form>
  );
}
