import { createClient } from "@/lib/supabase/server";
import { getBudgetMatrix } from "@/lib/finance/budget-queries";
import { getBreakEvenInputs } from "@/lib/finance/break-even-queries";
import { getOverheadInputs } from "@/lib/finance/overhead-queries";
import { getCashFlowData } from "@/lib/finance/cash-flow-queries";
import { getEmployees, getBurdenRate, getUtilization } from "@/lib/finance/labor-queries";
import { getBusinessUnits, getSeasonalityInput, getActuals } from "@/lib/finance/sales-trend-queries";
import { computeCashFlow } from "@/lib/finance/cash-flow";
import { computeLaborBurden, blendedCrewRate } from "@/lib/finance/labor-burden";
import { computeSeasonality, computeSalesTrend } from "@/lib/finance/sales-trend";
import { weekStartsForTimeline } from "@/lib/finance/periods";
import type { FinanceOverviewInput } from "@/lib/finance/metrics";
import type { PnlLine } from "@/lib/finance/types";

function currentMonday(): string {
  const now = new Date();
  const diff = (now.getUTCDay() + 6) % 7;
  now.setUTCDate(now.getUTCDate() - diff);
  return now.toISOString().slice(0, 10);
}

export async function getFinanceOverviewInput(fiscalYear = 2026): Promise<FinanceOverviewInput> {
  const supabase = await createClient();
  const [{ rows }, breakEven, overhead, cashData, util, employees, units, settingsRes, lastSyncRes] = await Promise.all([
    getBudgetMatrix(fiscalYear),
    getBreakEvenInputs(fiscalYear),
    getOverheadInputs(fiscalYear),
    getCashFlowData(),
    getUtilization(fiscalYear),
    getEmployees(),
    getBusinessUnits(),
    supabase.from("fin_company_settings").select("annual_revenue_plan").eq("fiscal_year", fiscalYear).single(),
    supabase.from("fin_sync_log").select("synced_at").eq("source", "quickbooks").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const pnlLines: PnlLine[] = rows.map((r) => ({
    accountId: r.account.id, name: r.account.name, section: r.account.section,
    costBehavior: r.account.cost_behavior, directType: r.account.direct_type as PnlLine["directType"],
    budget: r.budget.reduce((a, b) => a + b, 0), actual: r.actual.reduce((a, b) => a + b, 0), variance: 0,
  }));

  const burdenResults = await Promise.all(employees.map(async (e) => {
    const rates = await getBurdenRate(fiscalYear, e.comp.state, e.comp.wcCategory);
    return computeLaborBurden(e.comp, rates, util.current, util.goal);
  }));
  const loadedLaborRate = blendedCrewRate(burdenResults, "lbrCurrent");

  const monthIdx = new Date().getUTCMonth();
  let salesPlanYtd = 0, salesActualYtd = 0, reforecastYearEnd = 0;
  let monthlyBudgetTotal: number[] = Array(12).fill(0);
  for (const u of units) {
    const [seasonalityInput, actuals] = await Promise.all([getSeasonalityInput(u.id), getActuals(u.id, fiscalYear)]);
    const seasonality = computeSeasonality(seasonalityInput);
    const res = computeSalesTrend({ annualBudget: Number(u.annual_budget), seasonality, actuals, lastYearMonthly: seasonalityInput.years.at(-1)?.monthly });
    salesPlanYtd += res.cumulativeBudget[monthIdx] ?? 0;
    salesActualYtd += res.cumulativeActual[monthIdx] ?? 0;
    reforecastYearEnd += res.reforecastToGoal.reduce((a, b) => a + b, 0);
    monthlyBudgetTotal = monthlyBudgetTotal.map((v, m) => v + res.monthlyBudget[m]);
  }

  const weekStarts = weekStartsForTimeline(currentMonday());
  const salesForecastWeekly: Record<string, number> = {};
  for (const ws of weekStarts) {
    const m = Number(ws.slice(5, 7)) - 1;
    salesForecastWeekly[ws] = (monthlyBudgetTotal[m] ?? 0) / 4.345;
  }
  const cashFlow = computeCashFlow({ ...cashData, weekStarts, weeklyActuals: {}, salesForecastWeekly });

  const sumUnitBudgets = units.reduce((a, u) => a + Number(u.annual_budget), 0);

  return {
    pnlLines, breakEven, overhead, cashFlow, currentWeekIndex: 4,
    salesPlanYtd, salesActualYtd, reforecastYearEnd, loadedLaborRate,
    lastQbSyncAt: (lastSyncRes.data?.synced_at as string) ?? null,
    reconc: { sbuBudgetSum: sumUnitBudgets, annualPlan: Number(settingsRes.data?.annual_revenue_plan ?? 0), seasonalityWeightSum: 1 },
    nowIso: new Date().toISOString(),
  };
}
