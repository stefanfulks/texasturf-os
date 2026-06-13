"use client";

import { useActionState, useEffect, useRef } from "react";
import { createProduct, updateProduct, type ProductFormState } from "./actions";
import type { InvProduct } from "@/lib/db-helpers.types";

const initial: ProductFormState = { error: null, success: false };
const field = "field-input";

export function ProductForm({
  mode,
  product,
  onDone,
}: {
  mode: "create" | "edit";
  product?: InvProduct;
  onDone?: () => void;
}) {
  const action = mode === "create" ? createProduct : updateProduct;
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
      {mode === "edit" && product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-3 mb-1">Name <span className="text-danger">*</span></label>
          <input
            name="name"
            defaultValue={product?.name ?? ""}
            required
            placeholder="TexasLush 80oz"
            className={field}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">SKU</label>
          <input
            name="sku"
            defaultValue={product?.sku ?? ""}
            placeholder="TL-80-15"
            className={field}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Width (ft)</label>
          <input
            type="number" inputMode="decimal"
            step="0.25"
            min="0"
            name="width_ft"
            defaultValue={product?.width_ft ?? ""}
            placeholder="15"
            className={field}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Description</label>
        <input
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder="Optional details"
          className={field}
        />
      </div>

      {state.error && (
        <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {mode === "edit" && onDone && (
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary disabled:opacity-50"
        >
          {isPending ? (mode === "create" ? "Adding…" : "Saving…") : (mode === "create" ? "Add Product" : "Save")}
        </button>
      </div>
    </form>
  );
}
