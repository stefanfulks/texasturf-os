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
      <tr className="bg-zinc-50">
        <td colSpan={7} className="px-4 py-4">
          <ProductForm mode="edit" product={product} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className={`hover:bg-zinc-50 transition-colors ${!product.active ? "opacity-60" : ""}`}>
      <td className="px-4 py-3 font-medium text-zinc-800">{product.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-600">{product.sku ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-zinc-700">
        {product.width_ft != null ? `${product.width_ft} ft` : "—"}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-500 max-w-xs truncate">
        {product.description ?? "—"}
      </td>
      <td className="px-4 py-3 text-right text-sm text-zinc-700">{rollsInStock}</td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            product.active
              ? "bg-green-50 text-green-700"
              : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {product.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            Edit
          </button>
          <button
            onClick={() =>
              startTransition(() => toggleProductActive(product.id, !product.active))
            }
            disabled={isPending}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
          >
            {product.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}
