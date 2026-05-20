import { createClient } from "@/lib/supabase/server";

const UNIT_LABELS: Record<string, string> = {
  truck: "Truck",
  trailer: "Trailer",
  heavy_equipment: "Heavy Equipment",
};

export default async function FleetPage() {
  const supabase = await createClient();
  const { data: assets, error } = await supabase
    .from("assets")
    .select("id, name, unit_type, status, ready_status, notes")
    .order("unit_type", { ascending: true })
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
          <p className="text-sm text-zinc-600">
            Trucks, trailers, and heavy equipment.
          </p>
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
                <tr key={a.id} className="hover:bg-zinc-50">
                  <Td className="font-medium text-zinc-900">{a.name}</Td>
                  <Td>{UNIT_LABELS[a.unit_type] ?? a.unit_type}</Td>
                  <Td>{a.status}</Td>
                  <Td>{a.ready_status ?? "—"}</Td>
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
