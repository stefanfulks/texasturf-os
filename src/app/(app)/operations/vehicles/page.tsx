import Link from "next/link";
import {
  listMaintenanceLogsForListPage,
  sumMaintenanceCostInRange,
  findActiveBudget,
} from "@/lib/warehouse/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vehicle Maintenance · TexasTurf OS" };

const UNIT_TYPE_FILTERS = [
  { key: "all",             label: "All vehicles" },
  { key: "truck",           label: "Trucks" },
  { key: "trailer",         label: "Trailers" },
  { key: "heavy_equipment", label: "Heavy equipment" },
] as const;

function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

function monthBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit } = await searchParams;
  const activeFilter = UNIT_TYPE_FILTERS.some((f) => f.key === unit) ? unit! : "all";

  const today = new Date();
  const { start, end } = monthBounds(today);
  const todayIso = today.toISOString().slice(0, 10);

  const [logs, monthSpend, budget] = await Promise.all([
    listMaintenanceLogsForListPage({
      unitType: activeFilter === "all" ? undefined : activeFilter,
      limit:    100,
    }),
    sumMaintenanceCostInRange({ fromIso: start.toISOString(), toIso: end.toISOString() }),
    findActiveBudget({ kind: "vehicle_maintenance", todayIso }),
  ]);

  const monthLabel = today.toLocaleString(undefined, { month: "long", year: "numeric" });
  const budgetPct =
    budget && budget.amount_cents > 0
      ? Math.min(100, Math.round((monthSpend / budget.amount_cents) * 100))
      : null;
  const overBudget = budget != null && monthSpend > budget.amount_cents;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vehicle Maintenance</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            Service log per vehicle, with cost vs budget for the current period.
          </p>
        </div>
        <Link
          href="/operations/vehicles/new"
          className="btn btn-primary"
        >
          + Log service
        </Link>
      </div>

      {/* ─── Spend rollup ───────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-ink-3">{monthLabel} spend</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtUSD(monthSpend)}</div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-ink-3">Budget</div>
          {budget ? (
            <>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {fmtUSD(budget.amount_cents)}
              </div>
              <div className="text-xs text-ink-3 mt-0.5">
                {budget.period_start} → {budget.period_end}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-ink-3">
              No active budget.{" "}
              <Link href="/operations/budgets" className="underline text-ink-2 hover:text-ink">
                Set one →
              </Link>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-ink-3">Vs budget</div>
          {budget ? (
            <>
              <div className={"mt-1 text-2xl font-semibold tabular-nums " + (overBudget ? "text-danger" : "text-ink")}>
                {budgetPct ?? 0}%
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-sunken overflow-hidden">
                <div
                  className={"h-full " + (overBudget ? "bg-danger" : "bg-ink")}
                  style={{ width: `${Math.min(budgetPct ?? 0, 100)}%` }}
                />
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-ink-3">—</div>
          )}
        </div>
      </section>

      {/* ─── Filter pills ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1">
        {UNIT_TYPE_FILTERS.map((f) => {
          const active = f.key === activeFilter;
          const href = f.key === "all" ? "/operations/vehicles" : `/operations/vehicles?unit=${f.key}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                (active
                  ? "border-ink bg-brand text-white"
                  : "border-line bg-white text-ink-2 hover:border-line-strong")
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* ─── Log table ──────────────────────────────────────────────── */}
      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
          <p className="text-sm font-medium text-ink-2">No maintenance logged yet for this filter.</p>
          <p className="mt-1 text-xs text-ink-3">
            Log a service when work&apos;s done — gas, oil, tires, repairs, inspections.
          </p>
          <Link
            href="/operations/vehicles/new"
            className="btn btn-primary mt-4"
          >
            + Log service
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-hover text-left text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-3 py-2 font-medium">Service date</th>
                <th className="px-3 py-2 font-medium">Vehicle</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium text-right">Cost</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-hover">
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtDate(r.performed_at)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{r.asset?.name ?? "—"}</div>
                    <div className="text-xs text-ink-3 capitalize">{r.asset?.unit_type.replace("_", " ")}</div>
                  </td>
                  <td className="px-3 py-2 text-ink-2 max-w-md truncate">{r.description}</td>
                  <td className="px-3 py-2 text-ink-2">
                    {r.vendor ?? r.performed_by_vendor ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtUSD(r.cost_cents)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/operations/vehicles/${r.id}`}
                      className="text-xs font-medium text-ink-2 hover:text-ink"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
