import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReservationForm } from "./reservation-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Reservation · TexasTurf OS" };

export default async function NewReservationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only show vehicles that can be reserved: trucks + non-archived, non-out-of-service.
  const [assetsRes, profilesRes] = await Promise.all([
    supabase
      .from("assets")
      .select("id, name, unit_type, status")
      .in("unit_type", ["truck", "trailer"])
      .neq("status", "out_of_service")
      .or("archived.is.null,archived.eq.false")
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true }),
  ]);

  const assets = (assetsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    unitType: a.unit_type as string,
  }));

  const profiles = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    label: p.full_name || p.email || p.id,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link href="/fleet/reservations" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Reservations
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New reservation</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Book a work vehicle. Conflicts with existing bookings are checked on save.
        </p>
      </div>
      {assets.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No bookable vehicles found. Add a truck or trailer in{" "}
          <Link href="/fleet" className="underline font-medium">Fleet</Link>.
        </div>
      ) : (
        <ReservationForm assets={assets} profiles={profiles} currentUserId={user.id} />
      )}
    </div>
  );
}
