import type { SeasonalityInput, SeasonalityResult, SalesTrendInput, SalesTrendResult } from "@/lib/finance/types";

export function computeSeasonality(input: SeasonalityInput): SeasonalityResult {
  const totalWeight = input.years.reduce((a, y) => a + y.weightPct, 0);
  const weightedAvg = Array.from({ length: 12 }, (_, m) => {
    if (totalWeight > 0) return input.years.reduce((a, y) => a + y.monthly[m] * y.weightPct, 0);
    const n = input.years.length || 1;
    return input.years.reduce((a, y) => a + y.monthly[m], 0) / n;
  });
  const total = weightedAvg.reduce((a, b) => a + b, 0);
  const pctOfYearly = weightedAvg.map((v) => (total > 0 ? v / total : 0));
  return { weightedAvg, pctOfYearly };
}

export function computeSalesTrend(input: SalesTrendInput): SalesTrendResult {
  const { annualBudget, seasonality, actuals, lastYearMonthly } = input;
  const monthlyBudget = seasonality.pctOfYearly.map((p) => annualBudget * p);

  const cumulativeBudget: number[] = [];
  const cumulativeActual: number[] = [];
  const attainmentPct: number[] = [];
  const varianceVsBudget: number[] = [];
  const varianceVsLastYear: number[] = [];
  const monthlyVariance: number[] = [];
  const cumulativeVariance: number[] = [];

  let cumBudget = 0, cumActual = 0, cumVar = 0;
  let lastActualMonth = -1;
  for (let m = 0; m < 12; m++) {
    cumBudget += monthlyBudget[m];
    cumulativeBudget.push(cumBudget);
    const a = actuals[m];
    if (a != null) { cumActual += a; lastActualMonth = m; }
    cumulativeActual.push(cumActual);
    attainmentPct.push(cumBudget > 0 ? cumActual / cumBudget : 0);
    const mv = a != null ? a - monthlyBudget[m] : 0;
    monthlyVariance.push(mv);
    cumVar += mv;
    cumulativeVariance.push(cumVar);
    varianceVsBudget.push(a != null && monthlyBudget[m] > 0 ? a / monthlyBudget[m] - 1 : 0);
    const ly = lastYearMonthly?.[m] ?? 0;
    varianceVsLastYear.push(a != null && ly > 0 ? a / ly - 1 : 0);
  }

  const cumActualToDate = lastActualMonth >= 0 ? cumulativeActual[lastActualMonth] : 0;
  const remainingGap = annualBudget - cumActualToDate;
  const remainingPctSum = seasonality.pctOfYearly.reduce((a, p, m) => a + (actuals[m] == null ? p : 0), 0);
  const latestAttainment = lastActualMonth >= 0 ? attainmentPct[lastActualMonth] : 1;

  const reforecastToGoal = actuals.map((a, m) =>
    a != null ? a : (remainingPctSum > 0 ? (seasonality.pctOfYearly[m] / remainingPctSum) * remainingGap : 0));
  const reforecastRunRate = actuals.map((a, m) => (a != null ? a : monthlyBudget[m] * latestAttainment));

  return {
    monthlyBudget, cumulativeBudget, cumulativeActual, attainmentPct,
    varianceVsBudget, varianceVsLastYear, monthlyVariance, cumulativeVariance,
    reforecastToGoal, reforecastRunRate,
  };
}
