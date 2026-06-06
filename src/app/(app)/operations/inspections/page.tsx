import Link from "next/link";
import { listInspections, listAssets } from "@/lib/warehouse/queries";

export const dynamic = "force-dynamic";

export default async function InspectionsListPage() {
  const [inspections, assets] = await Promise.all([
    listInspections({ limit: 100 }),
    listAssets(),
  ]);
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  return (
    <main className="min-h-dvh bg-zinc-50 px-8 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Equipment Inspections</h1>
          <Link href="/operations" className="text-sm text-zinc-500 hover:underline">
            ← Warehouse
          </Link>
        </div>

        <div className="mt-4 flex justify-end">
          <Link
            href="/operations/inspections/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            New inspection
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Inspector</th>
                <th className="px-3 py-2 font-medium">Truck</th>
                <th className="px-3 py-2 font-medium">Trailer</th>
                <th className="px-3 py-2 font-medium">Equipment</th>
                <th className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((row) => {
                const truck = row.truck_id ? assetMap.get(row.truck_id) : null;
                const trailer = row.trailer_id ? assetMap.get(row.trailer_id) : null;
                const equipment = row.equipment_id ? assetMap.get(row.equipment_id) : null;
                return (
                  <tr
                    key={row.id}
                    className="border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <td className="px-3 py-2 tabular-nums">
                      <Link href={`/operations/inspections/${row.id}`} className="hover:underline">
                        {new Date(row.inspected_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.inspector}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{truck?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{trailer?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{equipment?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <ResultBadge result={row.result} />
                    </td>
                  </tr>
                );
              })}
              {inspections.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">
                    No inspections yet.{" "}
                    <Link href="/operations/inspections/new" className="underline">
                      Record one
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function ResultBadge({ result }: { result: "pass" | "fail" }) {
  const cls =
    result === "pass"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
      : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{result}</span>;
}
