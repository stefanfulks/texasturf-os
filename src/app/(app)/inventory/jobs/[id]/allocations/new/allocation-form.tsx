"use client";

import { useActionState } from "react";
import type { AllocationFormState } from "../../../actions";
import type { InvProduct } from "@/lib/db-helpers.types";

const initial: AllocationFormState = { error: null, success: false };
const field =
  "field-input";

export function AllocationForm({
  jobId,
  products,
  action,
}: {
  jobId: string;
  products: Pick<InvProduct, "id" | "name" | "width_ft">[];
  action: (prev: AllocationFormState, fd: FormData) => Promise<AllocationFormState>;
}) {
  const [state, formAction, isPending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="job_id" value={jobId} />

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Product</label>
        <select name="product_id" defaultValue="" className={field}>
          <option value="">— Select a catalogued product (optional) —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.width_ft != null ? ` (${p.width_ft} ft)` : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-4 mt-1">Or enter a product name manually below.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Product Name (free text)</label>
        <input
          name="product_name"
          placeholder="e.g. Pristine Pro 75oz"
          className={field}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Width (ft)</label>
          <input
            type="number" inputMode="decimal"
            step="0.01"
            name="width_ft"
            placeholder="15"
            className={field}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Requested Length (ft)</label>
          <input
            type="number" inputMode="decimal"
            step="0.01"
            name="requested_length_ft"
            placeholder="120"
            className={field}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Dye Lot Preference</label>
        <input
          name="dye_lot_preference"
          placeholder="Optional — must match this dye lot"
          className={field}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Notes</label>
        <textarea name="notes" rows={2} className={`${field} resize-none`} />
      </div>

      {state.error && (
        <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add Allocation"}
        </button>
      </div>
    </form>
  );
}
