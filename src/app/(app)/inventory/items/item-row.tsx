"use client";

import { useState, useTransition } from "react";
import { toggleItemActive } from "./actions";
import { ItemForm } from "./item-form";
import { ItemAdjustButton } from "./item-adjust-button";
import type { InvItem, InvLocation } from "@/lib/db-helpers.types";

export function ItemRow({
  item,
  locations,
  locationName,
}: {
  item: InvItem;
  locations: Pick<InvLocation, "id" | "name">[];
  locationName: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <tr className="bg-zinc-50">
        <td colSpan={8} className="px-4 py-4">
          <ItemForm
            mode="edit"
            item={item}
            locations={locations}
            onDone={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity;

  return (
    <tr className={`hover:bg-zinc-50 transition-colors ${!item.active ? "opacity-60" : ""}`}>
      <td className="px-4 py-3 font-medium text-zinc-800">{item.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-600">{item.sku ?? "—"}</td>
      <td className={`px-4 py-3 text-right font-medium ${isLow ? "text-red-700" : "text-zinc-700"}`}>
        {item.quantity}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-600">{item.unit}</td>
      <td className="px-4 py-3 text-right text-sm text-zinc-500">{item.min_quantity}</td>
      <td className="px-4 py-3 text-sm text-zinc-600">{locationName ?? "—"}</td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            item.active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {item.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="relative flex items-center justify-end gap-2">
          <ItemAdjustButton itemId={item.id} itemName={item.name} />
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            Edit
          </button>
          <button
            onClick={() =>
              startTransition(() => toggleItemActive(item.id, !item.active))
            }
            disabled={isPending}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
          >
            {item.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}
