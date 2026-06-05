import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReservationForm } from "./reservation-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Reservation · TexasTurf OS" };

export default async function NewReservationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
    <div className="max-w-xl mx-auto px-4 py-4 sm:py-6 space-y-5 pb-12">
      <Link
        href="/fleet/reservations"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-zinc-500 hover:text-zinc-900 active:text-zinc-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Reservations
      </Link>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
          Reserve a vehicle
        </h1>
        <p className="text-sm sm:text-base text-zinc-600 mt-1">
          We&apos;ll check for conflicts before saving.
        </p>
      </div>
      {assets.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">No bookable vehicles found.</p>
          <p className="mt-1">
            Add a truck or trailer in{" "}
            <Link href="/fleet" className="underline font-semibold">Fleet</Link> first.
          </p>
        </div>
      ) : (
        <ReservationForm assets={assets} profiles={profiles} currentUserId={user.id} />
      )}
    </div>
  );
}
