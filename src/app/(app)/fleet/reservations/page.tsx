import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Truck, MapPin, User, Plus } from "lucide-react";
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

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayLabel(iso: string): string {
  const now = startOfDay(new Date());
  const day = startOfDay(new Date(iso));
  const diff = Math.round((day.getTime() - now.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "long" });
  }
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
  const endDay = e.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${fmtTime(starts)} → ${endDay} ${fmtTime(ends)}`;
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

  const grouped = new Map<string, Reservation[]>();
  for (const r of reservations) {
    const label = dayLabel(r.starts_at);
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(r);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6 space-y-5 pb-32 sm:pb-6">
      <Link
        href="/fleet"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-zinc-500 hover:text-zinc-900 active:text-zinc-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Fleet
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            Vehicle Reservations
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 mt-1">
            Book a truck or trailer. We&apos;ll check for conflicts before saving.
          </p>
        </div>
        <Link
          href="/fleet/reservations/new"
          className="hidden sm:inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 active:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          New reservation
        </Link>
      </div>

      {resRes.error ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">No reservations table yet.</p>
          <p className="mt-1">
            Apply migration{" "}
            <code className="font-mono text-xs">20260605000000_vehicle_reservations.sql</code> and
            reload.
          </p>
          <p className="mt-2 text-xs opacity-75">Details: {resRes.error.message}</p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <div className="text-4xl mb-3">🚚</div>
          <p className="text-base font-semibold text-zinc-900">No upcoming reservations</p>
          <p className="text-sm text-zinc-500 mt-1">
            Nothing booked in the next 4 weeks. Grab a truck before someone else does.
          </p>
          <Link
            href="/fleet/reservations/new"
            className="inline-flex items-center gap-1.5 mt-4 h-11 px-5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 active:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            Reserve a vehicle
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([label, items]) => (
            <section key={label}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">
                {label}
              </h2>
              <ul className="space-y-2">
                {items.map((r) => {
                  const asset = assetMap.get(r.asset_id);
                  const driver = profileMap.get(r.driver_id);
                  const isMine = r.driver_id === user.id;
                  return (
                    <li
                      key={r.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
                          <Truck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-semibold text-zinc-900">
                              {asset?.name ?? "Unknown vehicle"}
                            </p>
                            {isMine && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                                Yours
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-zinc-700 mt-0.5 tabular-nums">
                            {fmtRange(r.starts_at, r.ends_at)}
                          </p>
                          <p className="text-sm text-zinc-700 mt-2">{r.purpose}</p>
                          {r.destination && (
                            <p className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                              <MapPin className="h-3 w-3" />
                              {r.destination}
                            </p>
                          )}
                          <p className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                            <User className="h-3 w-3" />
                            {driver?.full_name ?? driver?.email ?? "—"}
                          </p>
                          {r.notes && (
                            <p className="text-xs text-zinc-500 mt-2 italic leading-relaxed">
                              {r.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      {isMine && (
                        <form action={cancelReservation} className="mt-3 pt-3 border-t border-zinc-100">
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="w-full h-10 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-600 hover:border-red-300 hover:text-red-700 active:bg-red-50"
                          >
                            Cancel reservation
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Mobile FAB for "New reservation" */}
      <Link
        href="/fleet/reservations/new"
        className="sm:hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 inline-flex items-center gap-2 h-14 px-5 rounded-full bg-zinc-900 text-white text-sm font-semibold shadow-lg active:bg-zinc-700"
      >
        <Plus className="h-5 w-5" />
        New reservation
      </Link>
    </div>
  );
}
