import Link from "next/link";
import { warehouseDashboardCounts } from "@/lib/warehouse/queries";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const counts = await warehouseDashboardCounts();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold">Warehouse</h1>
        <Link href="/inventory" className="text-sm text-ink-3 hover:underline shrink-0">
          Inventory →
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-2">
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
          <h2 className="text-sm font-medium text-ink-3">Setup</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Card
              href="/operations/budgets"
              title="Spend Budgets"
              body="Set vehicle-maintenance and tool-purchase spend targets per period."
              cta="Manage"
              dim
            />
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
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 dark:border-line-strong dark:bg-ink">
      <div className="text-xs text-ink-3">{label}</div>
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
          ? "border-line bg-hover hover:border-line-strong dark:border-line-strong dark:bg-ink dark:hover:border-line-strong"
          : "border-line bg-white hover:border-line-strong dark:border-line-strong dark:bg-ink dark:hover:border-line-strong"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-ink-3">{cta} →</div>
      </div>
      <div className="mt-1 text-sm text-ink-2 dark:text-ink-4">{body}</div>
    </Link>
  );
}
