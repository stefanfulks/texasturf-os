"use client";

import { useState, useTransition } from "react";
import { toggleProductActive } from "./actions";
import { ProductForm } from "./product-form";
import type { InvProduct } from "@/lib/db-helpers.types";

export function ProductRow({
  product,
  rollsInStock,
}: {
  product: InvProduct;
  rollsInStock: number;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <tr className="bg-hover">
        <td colSpan={7} className="px-4 py-4">
          <ProductForm mode="edit" product={product} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className={`hover:bg-hover transition-colors ${!product.active ? "opacity-60" : ""}`}>
      <td className="px-4 py-3 font-medium text-ink">{product.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-ink-2">{product.sku ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-ink-2">
        {product.width_ft != null ? `${product.width_ft} ft` : "—"}
      </td>
      <td className="px-4 py-3 text-sm text-ink-3 max-w-xs truncate">
        {product.description ?? "—"}
      </td>
      <td className="px-4 py-3 text-right text-sm text-ink-2">{rollsInStock}</td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            product.active
              ? "bg-brand-tint text-brand"
              : "bg-sunken text-ink-3"
          }`}
        >
          {product.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-ink-2 hover:text-ink"
          >
            Edit
          </button>
          <button
            onClick={() =>
              startTransition(() => toggleProductActive(product.id, !product.active))
            }
            disabled={isPending}
            className="text-xs font-medium text-ink-3 hover:text-ink disabled:opacity-50"
          >
            {product.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}
