import { rollupPnl } from "@/lib/finance/pnl";
import { computeBreakEven } from "@/lib/finance/break-even";
import { computeOverhead } from "@/lib/finance/overhead";
import { checkReconciliation } from "@/lib/finance/guardrails";
import type { PnlLine, CashFlowResult, BreakEvenInput, OverheadInput } from "@/lib/finance/types";

export type FinanceOverviewInput = {
  pnlLines: PnlLine[];
  breakEven: BreakEvenInput;
  overhead: OverheadInput;
  cashFlow: CashFlowResult;
  currentWeekIndex: number;
  salesPlanYtd: number;
  salesActualYtd: number;
  reforecastYearEnd: number;
  loadedLaborRate: number;
  lastQbSyncAt: string | null;
  reconc: { sbuBudgetSum: number; annualPlan: number; seasonalityWeightSum: number };
  nowIso?: string;
};

export type FinanceOverview = {
  cashOnHand: number; availCredit: number; workingCapital: number; runwayWeeks: number;
  pnl: { budgetNetIncome: number; actualNetIncome: number; varianceNetIncome: number };
  grossMarginPct: number;
  breakEvenRevenue: number; profitGoalRevenue: number; breakEvenAttainmentPct: number;
  salesPlanYtd: number; salesActualYtd: number; salesPacePct: number; reforecastYearEnd: number;
  loadedLaborRate: number; overheadRate: number;
  alerts: string[]; lastQbSyncAt: string | null;
};

function daysBefore(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export function computeFinanceOverview(input: FinanceOverviewInput): FinanceOverview {
  const weeks = input.cashFlow.weeks;
  const cur = weeks[input.currentWeekIndex] ?? weeks[0];
  const cashOnHand = cur?.endingCash ?? 0;
  const availCredit = cur?.endingAvailCredit ?? 0;
  const workingCapital = cur?.workingCapital ?? 0;

  let runwayWeeks = weeks.length;
  let depleted = false;
  for (let i = input.currentWeekIndex; i < weeks.length; i++) {
    if (weeks[i].endingCash <= 0) { runwayWeeks = i + 1; depleted = true; break; }
  }

  const roll = rollupPnl(input.pnlLines);
  const be = computeBreakEven(input.breakEven);
  const oh = computeOverhead(input.overhead);
  const actualRevenue = input.pnlLines.filter((l) => l.section === "income").reduce((a, l) => a + l.actual, 0);
  const breakEvenAttainmentPct = be.breakEvenRevenue > 0 ? actualRevenue / be.breakEvenRevenue : 0;
  const salesPacePct = input.salesPlanYtd > 0 ? input.salesActualYtd / input.salesPlanYtd : 0;

  const alerts = checkReconciliation({
    sbuBudgetSum: input.reconc.sbuBudgetSum, annualPlan: input.reconc.annualPlan,
    seasonalityWeightSum: input.reconc.seasonalityWeightSum, quotePrice: null, loadedBreakeven: null,
  });
  if (depleted) alerts.push(`Cash runway: projected to run out of cash in ${runwayWeeks} week(s).`);
  if (roll.actual.netIncome < 0) alerts.push(`Net income is negative (${Math.round(roll.actual.netIncome).toLocaleString()}).`);
  const now = input.nowIso ?? "";
  if (!input.lastQbSyncAt) alerts.push("QuickBooks has not synced yet.");
  else if (now && input.lastQbSyncAt < daysBefore(now, 2)) alerts.push("QuickBooks sync is stale (over 2 days old).");

  return {
    cashOnHand, availCredit, workingCapital, runwayWeeks,
    pnl: { budgetNetIncome: roll.budget.netIncome, actualNetIncome: roll.actual.netIncome, varianceNetIncome: roll.variance.netIncome },
    grossMarginPct: roll.actual.grossMarginPct,
    breakEvenRevenue: be.breakEvenRevenue, profitGoalRevenue: be.profitGoalRevenue, breakEvenAttainmentPct,
    salesPlanYtd: input.salesPlanYtd, salesActualYtd: input.salesActualYtd, salesPacePct, reforecastYearEnd: input.reforecastYearEnd,
    loadedLaborRate: input.loadedLaborRate, overheadRate: oh.absorptionRate,
    alerts, lastQbSyncAt: input.lastQbSyncAt,
  };
}
