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
      <tr className="bg-hover">
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
    <tr className={`hover:bg-hover transition-colors ${!item.active ? "opacity-60" : ""}`}>
      <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-ink-2">{item.sku ?? "—"}</td>
      <td className={`px-4 py-3 text-right font-medium ${isLow ? "text-danger" : "text-ink-2"}`}>
        {item.quantity}
      </td>
      <td className="px-4 py-3 text-sm text-ink-2">{item.unit}</td>
      <td className="px-4 py-3 text-right text-sm text-ink-3">{item.min_quantity}</td>
      <td className="px-4 py-3 text-sm text-ink-2">{locationName ?? "—"}</td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            item.active ? "bg-brand-tint text-brand" : "bg-sunken text-ink-3"
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
            className="text-xs font-medium text-ink-2 hover:text-ink"
          >
            Edit
          </button>
          <button
            onClick={() =>
              startTransition(() => toggleItemActive(item.id, !item.active))
            }
            disabled={isPending}
            className="text-xs font-medium text-ink-3 hover:text-ink disabled:opacity-50"
          >
            {item.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}
