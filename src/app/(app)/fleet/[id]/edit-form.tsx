"use client";

import { useActionState } from "react";
import { updateAsset, type UpdateAssetState } from "./actions";
import type { Asset } from "@/lib/db-helpers.types";

const STATUS_OPTIONS: { value: Asset["status"]; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "assigned_to_job", label: "Assigned to Job" },
  { value: "in_use_today", label: "In Use Today" },
  { value: "maintenance_needed", label: "Maintenance Needed" },
  { value: "out_of_service", label: "Out of Service" },
];

const READY_OPTIONS: { value: Asset["ready_status"]; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "needs_prep", label: "Needs Prep" },
  { value: "not_ready", label: "Not Ready" },
];

const LOAD_OPTIONS: { value: Asset["load_status"]; label: string }[] = [
  { value: "empty", label: "Empty" },
  { value: "partially_loaded", label: "Partially Loaded" },
  { value: "fully_loaded", label: "Fully Loaded" },
  { value: "trash", label: "Trash" },
];

const initialState: UpdateAssetState = { error: null, success: false };

export function EditForm({ asset }: { asset: Asset }) {
  const [state, formAction, isPending] = useActionState(updateAsset, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={asset.id} />

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Name</label>
        <input
          name="name"
          defaultValue={asset.name}
          required
          className="field-input"
        />
      </div>

      {/* Status, Ready, Load — 3 columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Status</label>
          <select
            name="status"
            defaultValue={asset.status}
            className="field-input"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Ready Status</label>
          <select
            name="ready_status"
            defaultValue={asset.ready_status}
            className="field-input"
          >
            {READY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Load Status</label>
          <select
            name="load_status"
            defaultValue={asset.load_status}
            className="field-input"
          >
            {LOAD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Next Action */}
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Next Action</label>
        <input
          name="next_action"
          defaultValue={asset.next_action ?? ""}
          placeholder="e.g. Needs oil change before Friday"
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-line-strong"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Notes</label>
        <textarea
          name="notes"
          defaultValue={asset.notes ?? ""}
          rows={3}
          placeholder="Any additional notes..."
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-line-strong focus:outline-none focus:ring-1 focus:ring-line-strong resize-none"
        />
      </div>

      {/* Feedback */}
      {state.success && (
        <p className="rounded-md bg-brand-tint border border-brand/30 px-3 py-2 text-sm text-brand">
          Saved successfully.
        </p>
      )}
      {state.error && (
        <p className="rounded-md bg-danger-tint border border-danger/30 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
