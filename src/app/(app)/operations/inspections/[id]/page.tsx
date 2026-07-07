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
    <main className="min-h-dvh bg-hover px-8 py-12 dark:bg-ink">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-baseline justify-between">
          <h1 className="page-title">Inspection</h1>
          <Link href="/operations/inspections" className="text-sm text-ink-3 hover:underline">
            ← Inspections
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ResultBadge result={inspection.result} />
          <div className="text-sm text-ink-2 dark:text-ink-4">
            {new Date(inspection.inspected_at).toLocaleString()} · Inspector{" "}
            <span className="font-medium text-ink dark:text-ink-4">{inspection.inspector}</span>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
          <Meta label="Truck" value={truck?.name ?? "—"} />
          <Meta label="Trailer" value={trailer?.name ?? "—"} />
          <Meta label="Equipment" value={equipment?.name ?? "—"} />
        </section>

        {inspection.failure_notes && (
          <section className="mt-6 rounded-lg border border-danger/30 bg-danger-tint p-4 text-sm text-danger dark:border-danger/30/40 dark:bg-danger/20 dark:text-danger">
            <div className="font-medium">Failure notes</div>
            <div className="mt-1 whitespace-pre-wrap">{inspection.failure_notes}</div>
          </section>
        )}

        <section className="mt-8 space-y-6">
          {INSPECTION_CHECKLIST.map((section) => {
            const sectionItems = inspection.items[section.section] as Record<string, boolean | null>;
            return (
              <div key={section.section} className="rounded-lg border border-line dark:border-line-strong">
                <div className="border-b border-line bg-hover px-4 py-2 text-sm font-medium dark:border-line-strong dark:bg-ink">
                  {section.label}
                </div>
                <ul className="divide-y divide-line dark:divide-line">
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
    <div className="rounded-md border border-line bg-white p-3 dark:border-line-strong dark:bg-ink">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function ResultBadge({ result }: { result: "pass" | "fail" }) {
  const cls =
    result === "pass"
      ? "bg-brand-tint text-brand dark:bg-brand/40 dark:text-brand"
      : "bg-danger-tint text-danger dark:bg-danger/40 dark:text-danger";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${cls}`}>{result}</span>;
}

function ItemBadge({ value }: { value: boolean | null | undefined }) {
  if (value === true)
    return <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs text-brand dark:bg-brand/40 dark:text-brand">Yes</span>;
  if (value === false)
    return <span className="rounded-full bg-danger-tint px-2 py-0.5 text-xs text-danger dark:bg-danger/40 dark:text-danger">No</span>;
  return <span className="rounded-full bg-sunken px-2 py-0.5 text-xs text-ink-3 dark:bg-ink dark:text-ink-4">N/A</span>;
}
