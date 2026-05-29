"use client";

import { useActionState, useEffect, useRef } from "react";
import { createLocation, updateLocation, type LocationFormState } from "./actions";
import type { InvLocation } from "@/lib/database.types";

const initial: LocationFormState = { error: null, success: false };
const field = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";

export function LocationForm({
  mode,
  location,
  onDone,
}: {
  mode: "create" | "edit";
  location?: InvLocation;
  onDone?: () => void;
}) {
  const action = mode === "create" ? createLocation : updateLocation;
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
      {mode === "edit" && location && <input type="hidden" name="id" value={location.id} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Name *</label>
          <input
            name="name"
            defaultValue={location?.name ?? ""}
            required
            placeholder="Rack A-1, Zone 3"
            className={field}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
          <input
            name="description"
            defaultValue={location?.description ?? ""}
            placeholder="Optional notes"
            className={field}
          />
        </div>
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
          {isPending ? (mode === "create" ? "Adding…" : "Saving…") : (mode === "create" ? "Add Location" : "Save")}
        </button>
      </div>
    </form>
  );
}
