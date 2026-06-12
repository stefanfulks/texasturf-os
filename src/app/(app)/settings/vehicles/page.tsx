import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Truck, Wrench, Calendar as CalendarIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vehicles · Settings · TexasTurf OS" };

export default async function VehiclesSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [assetsRes, activeReservationsRes] = await Promise.all([
    supabase
      .from("assets")
      .select("id, unit_type, status")
      .or("archived.is.null,archived.eq.false"),
    (supabase.from("vehicle_reservations") as unknown as {
      select: (cols: string, opts: { count: "exact"; head: true }) => {
        eq: (c: string, v: string) => { gte: (c: string, v: string) => Promise<{ count: number | null }> };
      };
    })
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("ends_at", new Date().toISOString()),
  ]);

  const assets = assetsRes.data ?? [];
  const trucks = assets.filter((a) => a.unit_type === "truck").length;
  const trailers = assets.filter((a) => a.unit_type === "trailer").length;
  const heavy = assets.filter((a) => a.unit_type === "heavy_equipment").length;
  const outOfService = assets.filter((a) => a.status === "out_of_service").length;
  const activeReservations = activeReservationsRes.count ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-5">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-ink-3 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
        Settings
      </Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">Vehicles</h1>
        <p className="text-sm sm:text-base text-ink-2 mt-1">
          Fleet snapshot. Manage trucks, trailers, and reservations from here.
        </p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Stat label="Trucks" value={trucks} />
        <Stat label="Trailers" value={trailers} />
        <Stat label="Heavy equipment" value={heavy} />
        <Stat label="Out of service" value={outOfService} tone={outOfService > 0 ? "red" : "neutral"} />
      </section>

      <section className="space-y-3">
        <Tile
          href="/fleet"
          icon={<Truck className="h-5 w-5" />}
          title="Manage Fleet"
          description="Trucks, trailers, heavy equipment, maintenance"
          accent="green"
        />
        <Tile
          href="/fleet/reservations"
          icon={<CalendarIcon className="h-5 w-5" />}
          title="Vehicle Reservations"
          description={`${activeReservations} active reservation${activeReservations === 1 ? "" : "s"}`}
          badge={activeReservations > 0 ? `${activeReservations}` : undefined}
          accent="blue"
        />
        <Tile
          href="#"
          icon={<Wrench className="h-5 w-5" />}
          title="Maintenance schedules"
          description="Coming soon — set up recurring service reminders"
          comingSoon
          accent="amber"
        />
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "red" }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-ink-3 mb-0.5">{label}</p>
      <p className={"text-xl font-bold tabular-nums " + (tone === "red" ? "text-danger" : "text-ink")}>
        {value}
      </p>
    </div>
  );
}

function Tile({
  href,
  icon,
  title,
  description,
  badge,
  comingSoon,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  comingSoon?: boolean;
  accent: "green" | "blue" | "amber";
}) {
  const accentMap = {
    green: "bg-brand-tint text-brand",
    blue:  "bg-info-tint text-info",
    amber: "bg-warn-tint text-warn",
  };
  const inner = (
    <>
      <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${accentMap[accent]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {comingSoon && (
            <span className="rounded bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
              soon
            </span>
          )}
          {badge && (
            <span className="rounded-full bg-warn-tint text-warn px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-3 mt-0.5">{description}</p>
      </div>
    </>
  );

  if (comingSoon) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 opacity-60 cursor-not-allowed">
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 hover:border-line-strong hover:shadow-sm transition-all"
    >
      {inner}
    </Link>
  );
}
