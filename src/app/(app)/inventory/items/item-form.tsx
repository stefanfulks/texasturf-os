"use client";

import { useActionState, useEffect, useRef } from "react";
import { createItem, updateItem, type ItemFormState } from "./actions";
import type { InvItem, InvLocation } from "@/lib/database.types";

const initial: ItemFormState = { error: null, success: false };
const field = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";

export function ItemForm({
  mode,
  item,
  locations,
  onDone,
}: {
  mode: "create" | "edit";
  item?: InvItem;
  locations: Pick<InvLocation, "id" | "name">[];
  onDone?: () => void;
}) {
  const action = mode === "create" ? createItem : updateItem;
  const [state, formAction, isPending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      if (mode === "create") formRef.current?.reset();
      onDone?.();
    }
  }, [state.success, mode, onDone]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {mode === "edit" && item && <input type="hidden" name="id" value={item.id} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Name *</label>
          <input
            name="name"
            defaultValue={item?.name ?? ""}
            required
            placeholder="U-Staples"
            className={field}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">SKU</label>
          <input
            name="sku"
            defaultValue={item?.sku ?? ""}
            placeholder="Optional"
            className={field}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Unit *</label>
          <input
            name="unit"
            defaultValue={item?.unit ?? "each"}
            required
            placeholder="box, lb, gallon"
            className={field}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Quantity</label>
          <input
            type="number"
            step="0.25"
            min="0"
            name="quantity"
            defaultValue={item?.quantity ?? 0}
            className={field}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Min Quantity</label>
          <input
            type="number"
            step="0.25"
            min="0"
            name="min_quantity"
            defaultValue={item?.min_quantity ?? 0}
            className={field}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Location</label>
          <select
            name="location_id"
            defaultValue={item?.location_id ?? ""}
            className={field}
          >
            <option value="">— None —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Notes</label>
        <textarea
          name="notes"
          defaultValue={item?.notes ?? ""}
          rows={2}
          className={`${field} resize-none`}
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {mode === "edit" && onDone && (
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? (mode === "create" ? "Adding…" : "Saving…") : (mode === "create" ? "Add Item" : "Save")}
        </button>
      </div>
    </form>
  );
}
