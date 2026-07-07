import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getBusinessUnits, getSeasonalityInput, getActuals } from "@/lib/finance/sales-trend-queries";
import { computeSeasonality, computeSalesTrend } from "@/lib/finance/sales-trend";
import { usd } from "@/lib/finance/format";
import { SalesTrendView } from "./sales-trend-view";

export default async function SalesTrendPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  await requireAdmin();
  const { unit } = await searchParams;
  const units = await getBusinessUnits();
  const active = units.find((u) => u.id === unit) ?? units[0];

  const supabase = await createClient();
  const { data: settings } = await supabase.from("fin_company_settings").select("annual_revenue_plan").eq("fiscal_year", 2026).single();
  const plan = Number(settings?.annual_revenue_plan ?? 0);
  const sumUnitBudgets = units.reduce((a, u) => a + Number(u.annual_budget), 0);

  let view = null;
  if (active) {
    const [seasonalityInput, actuals] = await Promise.all([getSeasonalityInput(active.id), getActuals(active.id, 2026)]);
    const seasonality = computeSeasonality(seasonalityInput);
    const lastYear = seasonalityInput.years.at(-1)?.monthly;
    const result = computeSalesTrend({ annualBudget: Number(active.annual_budget), seasonality, actuals, lastYearMonthly: lastYear });
    view = <SalesTrendView businessUnitId={active.id} fiscalYear={2026} actuals={actuals} result={result} />;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="page-title">Sales trend &amp; reforecast</h1>
        <p className="text-ink-3 text-sm">FY2026 plan {usd(plan)}. Unit budgets total {usd(sumUnitBudgets)}.</p>
        {Math.abs(sumUnitBudgets - plan) > 1 && (
          <p className="text-warn text-sm mt-1">⚠ Business-unit budgets ({usd(sumUnitBudgets)}) don&apos;t equal the company plan ({usd(plan)}).</p>
        )}
      </header>
      <nav className="flex flex-wrap gap-1 text-sm">
        {units.map((u) => (
          <a key={u.id} href={`/admin/finance/sales-trend?unit=${u.id}`}
            className={"rounded-lg px-2.5 py-1 " + (active?.id === u.id ? "bg-brand text-white" : "bg-tint text-ink-2")}>{u.name}</a>
        ))}
      </nav>
      {view ?? <p className="text-ink-3">No business units yet — add them in Settings.</p>}
    </div>
  );
}
