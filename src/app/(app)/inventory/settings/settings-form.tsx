"use client";

import { useActionState } from "react";
import { saveInventorySettings, type SaveSettingsState } from "./actions";
import type { InvLocation } from "@/lib/db-helpers.types";
import type { InventorySettings } from "@/lib/inventory/settings";

const initialState: SaveSettingsState = { status: "idle" };

export function SettingsForm({
  settings,
  locations,
}: {
  settings: InventorySettings;
  locations: InvLocation[];
}) {
  const [state, formAction, pending] = useActionState(saveInventorySettings, initialState);

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
      {/* Default receiving location */}
      <div>
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">Default Receiving Location</span>
          <p className="text-xs text-zinc-500 mt-0.5">
            Pre-selected when receiving new rolls. Leave blank for none.
          </p>
          <select
            name="default_receiving_location_id"
            defaultValue={settings.default_receiving_location_id ?? ""}
            className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="">— None —</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1 font-mono">
            default_receiving_location_id
          </p>
        </label>
      </div>

      {/* Low-stock threshold factor */}
      <div>
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">Low-Stock Threshold Factor</span>
          <p className="text-xs text-zinc-500 mt-0.5">
            Multiplier on each item&apos;s min_quantity for the &quot;low stock&quot; warning.
            E.g. 1.5 = flag items when their quantity drops to 1.5× their minimum.
          </p>
          <input
            type="number"
            step="0.1"
            min="0.1"
            name="low_stock_threshold_factor"
            required
            defaultValue={settings.low_stock_threshold_factor}
            className="mt-2 block w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1 font-mono">
            low_stock_threshold_factor
          </p>
        </label>
      </div>

      {/* Auto-archive days */}
      <div>
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">Auto-Archive Completed Jobs After</span>
          <p className="text-xs text-zinc-500 mt-0.5">
            Number of days after a job is marked completed before it&apos;s auto-archived.
            Leave blank to never auto-archive.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              step="1"
              min="0"
              name="auto_archive_completed_jobs_after_days"
              placeholder="e.g. 30"
              defaultValue={settings.auto_archive_completed_jobs_after_days ?? ""}
              className="block w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
            <span className="text-sm text-zinc-500">days</span>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1 font-mono">
            auto_archive_completed_jobs_after_days
          </p>
        </label>
      </div>

      {state.status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </div>
      )}

      {state.status === "success" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
