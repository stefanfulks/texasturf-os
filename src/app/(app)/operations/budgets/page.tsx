import Link from "next/link";
import { listBudgetsWithSpend, type BudgetWithSpend } from "@/lib/warehouse/queries";
import { BudgetRow } from "./budget-row";
import { NewBudgetForm } from "./new-budget-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spend budgets · TexasTurf OS" };

const KIND_LABELS = {
  vehicle_maintenance: "Vehicle maintenance",
  tool_purchases:      "Tools & equipment",
} as const;

export default async function BudgetsPage() {
  const { vehicle_maintenance, tool_purchases } = await listBudgetsWithSpend();

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Spend budgets</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          Period spend targets that drive the vs-budget cards on{" "}
          <Link href="/operations/vehicles" className="underline">Vehicle Maintenance</Link>{" "}
          and{" "}
          <Link href="/operations/tools" className="underline">Tool Spend</Link>.
          One row = one period. Overlapping periods (e.g. quarterly + annual)
          are allowed — the spend page picks the tighter active row.
        </p>
      </div>

      <BudgetSection
        kind="vehicle_maintenance"
        title={KIND_LABELS.vehicle_maintenance}
        rows={vehicle_maintenance}
      />

      <BudgetSection
        kind="tool_purchases"
        title={KIND_LABELS.tool_purchases}
        rows={tool_purchases}
      />
    </div>
  );
}

function BudgetSection({
  kind,
  title,
  rows,
}: {
  kind: "vehicle_maintenance" | "tool_purchases";
  title: string;
  rows: BudgetWithSpend[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <span className="text-xs text-ink-3 tabular-nums">{rows.length} budget{rows.length === 1 ? "" : "s"}</span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-ink-3">
          No budgets set for this category yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-hover text-left text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 font-medium text-right">Budget</th>
                <th className="px-3 py-2 font-medium text-right">Spent</th>
                <th className="px-3 py-2 font-medium text-right">Vs</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <BudgetRow key={b.id} budget={b} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewBudgetForm kind={kind} />
    </section>
  );
}
