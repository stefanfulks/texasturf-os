"use client";

import { useState, useTransition } from "react";
import { toggleLocationActive } from "./actions";
import { LocationForm } from "./location-form";
import type { InvLocation } from "@/lib/db-helpers.types";

export function LocationRow({
  location,
  rollCount,
  itemCount,
}: {
  location: InvLocation;
  rollCount: number;
  itemCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <tr className="bg-hover">
        <td colSpan={6} className="px-4 py-4">
          <LocationForm mode="edit" location={location} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className={`hover:bg-hover transition-colors ${!location.active ? "opacity-60" : ""}`}>
      <td className="px-4 py-3 font-medium text-ink">{location.name}</td>
      <td className="px-4 py-3 text-sm text-ink-3 max-w-md truncate">
        {location.description || "—"}
      </td>
      <td className="px-4 py-3 text-sm text-right text-ink-2">{rollCount}</td>
      <td className="px-4 py-3 text-sm text-right text-ink-2">{itemCount}</td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            location.active
              ? "bg-brand-tint text-brand"
              : "bg-sunken text-ink-3"
          }`}
        >
          {location.active ? "Active" : "Inactive"}
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
              startTransition(() => toggleLocationActive(location.id, !location.active))
            }
            disabled={isPending}
            className="text-xs font-medium text-ink-3 hover:text-ink disabled:opacity-50"
          >
            {location.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </td>
    </tr>
  );
}
