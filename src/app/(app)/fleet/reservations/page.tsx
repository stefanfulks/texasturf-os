import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cancelReservation } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vehicle Reservations · TexasTurf OS" };

type Reservation = {
  id: string;
  asset_id: string;
  driver_id: string;
  starts_at: string;
  ends_at: string;
  purpose: string;
  destination: string | null;
  notes: string | null;
  status: string;
};

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtRange(starts: string, ends: string): string {
  const s = new Date(starts);
  const e = new Date(ends);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) return `${fmtTime(starts)} – ${fmtTime(ends)}`;
  return `${fmtTime(starts)} → ${fmtDay(ends)} ${fmtTime(ends)}`;
}

export default async function ReservationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date().toISOString();
  const fourWeeks = new Date();
  fourWeeks.setDate(fourWeeks.getDate() + 28);

  const [resRes, assetsRes, profilesRes] = await Promise.all([
    supabase
      .from("vehicle_reservations")
      .select("id, asset_id, driver_id, starts_at, ends_at, purpose, destination, notes, status")
      .eq("status", "active")
      .gte("ends_at", now)
      .lte("starts_at", fourWeeks.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("assets")
      .select("id, name, unit_type")
      .or("archived.is.null,archived.eq.false"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const assetMap = new Map((assetsRes.data ?? []).map((a) => [a.id, a]));
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const reservations = (resRes.data ?? []) as Reservation[];

  // Group by day for the agenda view.
  const grouped = new Map<string, Reservation[]>();
  for (const r of reservations) {
    const day = fmtDay(r.starts_at);
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(r);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <Link href="/fleet" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← Fleet
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Vehicle Reservations</h1>
          <p className="text-sm text-zinc-500">
            Reserve a work vehicle so two people don&apos;t show up to grab the same truck.
          </p>
        </div>
        <Link
          href="/fleet/reservations/new"
          className="bg-zinc-900 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-zinc-800 transition-colors"
        >
          New reservation
        </Link>
      </div>

      {resRes.error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">No reservations table yet.</p>
          <p className="mt-1">
            Apply the migration at{" "}
            <code className="font-mono">
              supabase/migrations/20260605000000_vehicle_reservations.sql
            </code>{" "}
            and reload.
          </p>
          <p className="mt-2 text-xs opacity-75">Details: {resRes.error.message}</p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
          No active reservations in the next 4 weeks.
          <div className="mt-3">
            <Link
              href="/fleet/reservations/new"
              className="text-zinc-900 underline font-medium"
            >
              Reserve a vehicle →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([day, items]) => (
            <div key={day} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-100">
                <p className="font-semibold text-zinc-900 text-sm">{day}</p>
              </div>
              <ul className="divide-y divide-zinc-100">
                {items.map((r) => {
                  const asset = assetMap.get(r.asset_id);
                  const driver = profileMap.get(r.driver_id);
                  const isMine = r.driver_id === user.id;
                  return (
                    <li key={r.id} className="px-4 py-3 flex flex-wrap items-start justify-between gap-3 hover:bg-zinc-50/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900">
                          {asset?.name ?? "Unknown vehicle"}
                          <span className="ml-2 text-xs font-normal text-zinc-500">
                            {fmtRange(r.starts_at, r.ends_at)}
                          </span>
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {r.purpose}
                          {r.destination && <> · {r.destination}</>}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Driver: {driver?.full_name ?? driver?.email ?? "—"}
                          {isMine && (
                            <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 font-medium">
                              you
                            </span>
                          )}
                        </p>
                        {r.notes && (
                          <p className="text-xs text-zinc-500 mt-1 italic">{r.notes}</p>
                        )}
                      </div>
                      {isMine && (
                        <form action={cancelReservation}>
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="text-xs text-zinc-500 hover:text-red-700 underline"
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
