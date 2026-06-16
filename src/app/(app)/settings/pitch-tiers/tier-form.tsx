"use client";
import { useActionState } from "react";
import { updateTier, type TierFormState } from "./actions";
import type { PitchTier, InvProduct } from "@/lib/db-helpers.types";

const initial: TierFormState = { error: null, success: false };
const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

export function TierForm({ tier, products }: { tier: PitchTier; products: InvProduct[] }) {
  const [state, formAction, isPending] = useActionState(updateTier, initial);
  const inclusions = Array.isArray(tier.inclusions) ? (tier.inclusions as string[]) : [];

  return (
    <form action={formAction} className="card p-4 space-y-3">
      <input type="hidden" name="id" value={tier.id} />
      <div className="flex items-center justify-between">
        <h3 className="display text-lg">{tier.name}</h3>
        <span className="chip chip-neutral">{tier.key}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-ink-3">Tier name
          <input name="name" defaultValue={tier.name} className={field} />
        </label>
        <label className="block text-xs font-medium text-ink-3">Client-facing product label
          <input name="product_label" defaultValue={tier.product_label} className={field} />
        </label>
        <label className="block text-xs font-medium text-ink-3">Featured inventory product
          <select name="inv_product_id" defaultValue={tier.inv_product_id ?? ""} className={field}>
            <option value="">— none —</option>
            {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </label>
        <label className="block text-xs font-medium text-ink-3">Cost product (pricing key)
          <input name="pricing_key" defaultValue={tier.pricing_key} className={field} />
        </label>
        <label className="block text-xs font-medium text-ink-3">Target margin %
          <input type="number" name="target_margin" min="30" max="70" step="1" defaultValue={Number(tier.target_margin)} className={field} />
        </label>
        <label className="block text-xs font-medium text-ink-3">Infill mode
          <select name="infill_mode" defaultValue={tier.infill_mode} className={field}>
            <option value="standard">Standard (infill)</option>
            <option value="none">None (zero-infill)</option>
          </select>
        </label>
      </div>

      <label className="block text-xs font-medium text-ink-3">What&apos;s included (one per line)
        <textarea name="inclusions" rows={5} defaultValue={inclusions.join("\n")} className={field} />
      </label>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">Saved.</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn btn-primary disabled:opacity-50">
          {isPending ? "Saving…" : "Save tier"}
        </button>
      </div>
    </form>
  );
}
