import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const UNIT_LABELS: Record<string, string> = {
  truck: "Truck",
  trailer: "Trailer",
  heavy_equipment: "Heavy Equipment",
};

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  assigned_to_job: "bg-blue-100 text-blue-800",
  in_use_today: "bg-amber-100 text-amber-800",
  maintenance_needed: "bg-orange-100 text-orange-800",
  out_of_service: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  assigned_to_job: "Assigned to Job",
  in_use_today: "In Use Today",
  maintenance_needed: "Maintenance Needed",
  out_of_service: "Out of Service",
};

const READY_COLORS: Record<string, string> = {
  ready: "bg-green-100 text-green-800",
  needs_prep: "bg-amber-100 text-amber-800",
  not_ready: "bg-red-100 text-red-800",
};

export default async function FleetPage({
  searchParams,
}: {
  searchParams?: Promise<{ archived?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const showArchived = params.archived === "1";
  const supabase = await createClient();
  // `archived` column comes from migration 20260530300000. Filter only when
  // the column actually exists — otherwise let the query fly without it.
  let query = supabase
    .from("assets")
    .select("id, name, unit_type, status, ready_status, notes")
    .order("unit_type", { ascending: true })
    .order("name", { ascending: true });
  // Cast through unknown — column not yet in generated types.
  query = showArchived
    ? (query.eq("archived" as never, true) as typeof query)
    : (query.or("archived.is.null,archived.eq.false") as typeof query);
  const { data: assets, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
          <p className="text-sm text-zinc-600">
            Trucks, trailers, and heavy equipment.
            {showArchived && <span className="ml-1 text-zinc-500">Showing archived assets.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/fleet/reservations"
            className="text-xs font-medium text-zinc-700 hover:text-zinc-900 px-2.5 py-1 rounded-md border border-zinc-200 bg-white hover:border-zinc-400"
          >
            Reservations →
          </Link>
          <Link
            href={showArchived ? "/fleet" : "/fleet?archived=1"}
            className="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1 rounded-md border border-zinc-200 bg-white hover:border-zinc-400"
          >
            {showArchived ? "← Active fleet" : "Show archived"}
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">No fleet data yet.</p>
          <p className="mt-1">
            The <code className="font-mono">assets</code> table hasn&apos;t been
            created. Apply the migration in{" "}
            <code className="font-mono">supabase/migrations/</code> and seed
            from the Monday board.
          </p>
          <p className="mt-2 text-xs opacity-75">Details: {error.message}</p>
        </div>
      ) : !assets || assets.length === 0 ? (
        <div className="rounded-md border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
          No assets yet. Seed from Monday or add one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Ready</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {assets.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-50 cursor-pointer">
                  <Td>
                    <Link href={`/fleet/${a.id}`} className="font-medium text-zinc-900 hover:underline">
                      {a.name}
                    </Link>
                  </Td>
                  <Td>{UNIT_LABELS[a.unit_type] ?? a.unit_type}</Td>
                  <Td>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status] ?? ""}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </Td>
                  <Td>
                    {a.ready_status ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${READY_COLORS[a.ready_status] ?? ""}`}>
                        {a.ready_status.replace("_", " ")}
                      </span>
                    ) : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-zinc-700 ${className ?? ""}`}>{children}</td>
  );
}
