"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, User, Calendar, Briefcase, MapPin, StickyNote, AlertCircle, CheckCircle2 } from "lucide-react";
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
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Inputs use text-base (16px) so iOS Safari doesn't auto-zoom on focus.
// All controls are h-12 (48px) — well above Apple's 44pt minimum.
const fieldCls =
  "block w-full h-12 rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900";

const textareaCls =
  "block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900";

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
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);

  useEffect(() => {
    if (state.status === "success") {
      router.push("/fleet/reservations");
    }
  }, [state.status, router]);

  // Shift the end forward whenever start moves past it — gentle UX nudge so
  // the user doesn't have to re-type two fields.
  function handleStartChange(value: string) {
    setStartsAt(value);
    if (new Date(endsAt) <= new Date(value)) {
      const s = new Date(value);
      s.setHours(s.getHours() + 1);
      setEndsAt(toLocalInput(s));
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Vehicle */}
      <FieldCard icon={<Truck className="h-4 w-4" />} label="Vehicle" required>
        <select name="asset_id" required defaultValue="" className={fieldCls}>
          <option value="" disabled>Pick a vehicle…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.unitType.replace("_", " ")})
            </option>
          ))}
        </select>
      </FieldCard>

      {/* Driver */}
      <FieldCard icon={<User className="h-4 w-4" />} label="Driver">
        <select name="driver_id" defaultValue={currentUserId} className={fieldCls}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}{p.id === currentUserId ? " (you)" : ""}
            </option>
          ))}
        </select>
      </FieldCard>

      {/* When */}
      <FieldCard icon={<Calendar className="h-4 w-4" />} label="When" required>
        <div className="space-y-3">
          <div>
            <span className="block text-xs font-medium text-zinc-500 mb-1">Pick up</span>
            <input
              type="datetime-local"
              name="starts_at"
              required
              value={startsAt}
              onChange={(e) => handleStartChange(e.target.value)}
              className={fieldCls}
            />
          </div>
          <div>
            <span className="block text-xs font-medium text-zinc-500 mb-1">Return by</span>
            <input
              type="datetime-local"
              name="ends_at"
              required
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={fieldCls}
            />
          </div>
        </div>
      </FieldCard>

      {/* Purpose */}
      <FieldCard icon={<Briefcase className="h-4 w-4" />} label="Purpose" required>
        <input
          type="text"
          name="purpose"
          required
          placeholder="Site visit, material pickup, demo run…"
          autoComplete="off"
          className={fieldCls}
        />
      </FieldCard>

      {/* Destination */}
      <FieldCard icon={<MapPin className="h-4 w-4" />} label="Destination" hint="Optional">
        <input
          type="text"
          name="destination"
          placeholder="Customer address or supply yard"
          autoComplete="off"
          className={fieldCls}
        />
      </FieldCard>

      {/* Notes */}
      <FieldCard icon={<StickyNote className="h-4 w-4" />} label="Notes" hint="Optional">
        <textarea
          name="notes"
          rows={3}
          placeholder="Trailer attached, fuel level on return, anything else…"
          className={textareaCls}
        />
      </FieldCard>

      {state.status === "error" && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{state.message}</p>
        </div>
      )}
      {state.status === "success" && (
        <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Reservation saved. Redirecting…</p>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-white via-white to-transparent">
        <button
          type="submit"
          disabled={pending}
          className="block w-full h-12 rounded-xl bg-zinc-900 text-base font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Reserve vehicle"}
        </button>
      </div>
    </form>
  );
}

function FieldCard({
  icon, label, required, hint, children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
          {icon}
        </span>
        <span className="text-sm font-semibold text-zinc-900">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[11px] text-zinc-400 ml-auto">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
