"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createReservation, type CreateReservationState } from "../actions";

const initialState: CreateReservationState = { status: "idle" };

function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(7, 0, 0, 0);
  return toLocalInput(d);
}

function defaultEnd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  return toLocalInput(d);
}

function toLocalInput(d: Date): string {
  // datetime-local needs YYYY-MM-DDTHH:mm in *local* time. toISOString uses UTC,
  // which shifts the displayed time. Build the string manually.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fieldCls =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

export function ReservationForm({
  assets,
  profiles,
  currentUserId,
}: {
  assets: { id: string; name: string; unitType: string }[];
  profiles: { id: string; label: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createReservation, initialState);

  useEffect(() => {
    if (state.status === "success") {
      router.push("/fleet/reservations");
    }
  }, [state.status, router]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <label className="block text-sm font-medium text-zinc-700">
        Vehicle
        <select name="asset_id" required defaultValue="" className={fieldCls}>
          <option value="" disabled>Pick a vehicle…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.unitType.replace("_", " ")})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Driver
        <select name="driver_id" defaultValue={currentUserId} className={fieldCls}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}{p.id === currentUserId ? " (you)" : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium text-zinc-700">
          Start
          <input
            type="datetime-local"
            name="starts_at"
            required
            defaultValue={defaultStart()}
            className={fieldCls}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          End
          <input
            type="datetime-local"
            name="ends_at"
            required
            defaultValue={defaultEnd()}
            className={fieldCls}
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-zinc-700">
        Purpose
        <input
          type="text"
          name="purpose"
          required
          placeholder="Job site visit, material pickup, demo run…"
          className={fieldCls}
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Destination <span className="text-xs text-zinc-400">(optional)</span>
        <input
          type="text"
          name="destination"
          placeholder="Customer address or supply yard"
          className={fieldCls}
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Notes <span className="text-xs text-zinc-400">(optional)</span>
        <textarea
          name="notes"
          rows={3}
          placeholder="Trailer attached, fuel level on return, etc."
          className={fieldCls}
        />
      </label>

      {state.status === "error" && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="text-sm text-emerald-700">Reservation saved. Redirecting…</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="block w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Reserve vehicle"}
      </button>
    </form>
  );
}
