import Link from "next/link";
import { notFound } from "next/navigation";
import { getAsset, getInspection } from "@/lib/warehouse/queries";
import { INSPECTION_CHECKLIST } from "@/lib/warehouse/types";

export const dynamic = "force-dynamic";

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inspection = await getInspection(id);
  if (!inspection) notFound();

  const [truck, trailer, equipment] = await Promise.all([
    inspection.truck_id ? getAsset(inspection.truck_id) : Promise.resolve(null),
    inspection.trailer_id ? getAsset(inspection.trailer_id) : Promise.resolve(null),
    inspection.equipment_id ? getAsset(inspection.equipment_id) : Promise.resolve(null),
  ]);

  return (
    <main className="min-h-dvh bg-zinc-50 px-8 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Inspection</h1>
          <Link href="/warehouse/inspections" className="text-sm text-zinc-500 hover:underline">
            ← Inspections
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ResultBadge result={inspection.result} />
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {new Date(inspection.inspected_at).toLocaleString()} · Inspector{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{inspection.inspector}</span>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
          <Meta label="Truck" value={truck?.name ?? "—"} />
          <Meta label="Trailer" value={trailer?.name ?? "—"} />
          <Meta label="Equipment" value={equipment?.name ?? "—"} />
        </section>

        {inspection.failure_notes && (
          <section className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
            <div className="font-medium">Failure notes</div>
            <div className="mt-1 whitespace-pre-wrap">{inspection.failure_notes}</div>
          </section>
        )}

        <section className="mt-8 space-y-6">
          {INSPECTION_CHECKLIST.map((section) => {
            const sectionItems = inspection.items[section.section] as Record<string, boolean | null>;
            return (
              <div key={section.section} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900">
                  {section.label}
                </div>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {section.items.map((item) => {
                    const v = sectionItems?.[item.key];
                    return (
                      <li key={item.key} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
                        <span>{item.label}</span>
                        <ItemBadge value={v} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function ResultBadge({ result }: { result: "pass" | "fail" }) {
  const cls =
    result === "pass"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
      : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${cls}`}>{result}</span>;
}

function ItemBadge({ value }: { value: boolean | null | undefined }) {
  if (value === true)
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/40 dark:text-green-300">Yes</span>;
  if (value === false)
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900/40 dark:text-red-300">No</span>;
  return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">N/A</span>;
}
