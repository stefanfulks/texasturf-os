"use client";

import { useActionState } from "react";
import { createVendor, updateVendor, type VendorFormState } from "./actions";
import type { Vendor } from "@/lib/database.types";

const initial: VendorFormState = { error: null, success: false };
const field = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";

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
          <label className="block text-xs font-medium text-zinc-500 mb-1">Name *</label>
          <input name="name" defaultValue={vendor?.name ?? ""} required placeholder="Hillcast LLC" className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Type *</label>
          <select name="type" defaultValue={vendor?.type ?? "contractor_1099"} className={field}>
            {VENDOR_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Contact Name</label>
          <input name="contact_name" defaultValue={vendor?.contact_name ?? ""} placeholder="John Smith" className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Email</label>
          <input type="email" name="email" defaultValue={vendor?.email ?? ""} placeholder="john@example.com" className={field} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Phone</label>
          <input name="phone" defaultValue={vendor?.phone ?? ""} placeholder="(512) 555-0100" className={field} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Payment Terms</label>
          <input name="payment_terms" defaultValue={vendor?.payment_terms ?? ""} placeholder="Net 15, on approval, etc." className={field} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Address</label>
        <input name="address" defaultValue={vendor?.address ?? ""} placeholder="Austin, TX" className={field} />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Notes</label>
        <textarea name="notes" defaultValue={vendor?.notes ?? ""} rows={2} className={`${field} resize-none`} />
      </div>

      {state.error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>}
      {state.success && mode === "edit" && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Saved.</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50">
          {isPending ? (mode === "create" ? "Adding…" : "Saving…") : (mode === "create" ? "Add Vendor" : "Save Changes")}
        </button>
      </div>
    </form>
  );
}
