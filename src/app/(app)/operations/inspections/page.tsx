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
    <main className="min-h-dvh bg-hover px-8 py-12 dark:bg-ink">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Equipment Inspections</h1>
          <Link href="/operations" className="text-sm text-ink-3 hover:underline">
            ← Warehouse
          </Link>
        </div>

        <div className="mt-4 flex justify-end">
          <Link
            href="/operations/inspections/new"
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink dark:bg-white dark:text-ink dark:hover:bg-line"
          >
            New inspection
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-line dark:border-line-strong">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-left dark:bg-ink">
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
                    className="border-t border-line hover:bg-hover dark:border-line-strong dark:hover:bg-ink"
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
                    <td className="px-3 py-2 text-ink-2 dark:text-ink-4">{truck?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-2 dark:text-ink-4">{trailer?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-2 dark:text-ink-4">{equipment?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <ResultBadge result={row.result} />
                    </td>
                  </tr>
                );
              })}
              {inspections.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-ink-3">
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
      ? "bg-brand-tint text-brand dark:bg-brand/40 dark:text-brand"
      : "bg-danger-tint text-danger dark:bg-danger/40 dark:text-danger";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{result}</span>;
}
