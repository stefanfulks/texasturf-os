import Link from "next/link";
import { warehouseDashboardCounts } from "@/lib/warehouse/queries";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const counts = await warehouseDashboardCounts();

  return (
    <main className="min-h-dvh bg-zinc-50 px-8 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Warehouse</h1>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← Home
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pull lists, inspections, deliveries, vehicles, and tool/equipment spend.
        </p>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Pull lists today" value={counts.pullsToday} />
          <Stat label="Inspections today" value={counts.inspectionsToday} />
          <Stat label="Deliveries today" value={counts.deliveriesToday} />
          <Stat label="Open pull lists" value={counts.openPulls} />
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card
            href="/operations/pull-lists"
            title="Pull Lists"
            body="Daily material assembly per job. Replaces the Pull List PDF."
            cta="Open"
          />
          <Card
            href="/operations/inspections"
            title="Equipment Inspections"
            body="Pre-departure safety checklist. Replaces the Inspection PDF."
            cta="Open"
          />
          <Card
            href="/operations/deliveries"
            title="Delivery Confirmations"
            body="Post-delivery Slack confirmations. Replaces the Delivery template."
            cta="Open"
          />
          <Card
            href="/operations/vehicles"
            title="Vehicle Maintenance"
            body="Service log + cost vs budget. Replaces the Google Sheet."
            cta="Open"
          />
          <Card
            href="/operations/tools"
            title="Tools & Equipment Spend"
            body="Purchase log + cost vs budget. Replaces the Google Sheet."
            cta="Open"
          />
          <Card
            href="/operations/assets"
            title="Assets"
            body="Trucks, trailers, heavy equipment, and tracked tools."
            cta="Manage"
          />
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium text-zinc-500">Setup</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Card
              href="/operations/employees"
              title="Employees"
              body="Drivers, stagers, leads, and warehouse staff."
              cta="Manage"
              dim
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Card({
  href,
  title,
  body,
  cta,
  dim,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
  dim?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border p-5 transition hover:shadow-sm ${
        dim
          ? "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-zinc-500">{cta} →</div>
      </div>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</div>
    </Link>
  );
}
