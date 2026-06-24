import { describe, it, expect } from "vitest";
import { computeFinanceOverview } from "@/lib/finance/metrics";
import type { PnlLine, CashFlowResult } from "@/lib/finance/types";

// Generic figures (repo is public).
const line = (id: string, section: PnlLine["section"], budget: number, actual: number): PnlLine =>
  ({ accountId: id, name: id, section, costBehavior: section === "income" ? "variable" : "fixed", directType: "na", budget, actual, variance: actual - budget });

const cashFlow: CashFlowResult = { weeks: [
  { weekStart: "2026-06-15", deposits: 0, expenses: 0, operatingProfit: 0, startingCash: 50000, endingCash: 40000, startingAvailCredit: 0, endingAvailCredit: 0, workingCapital: 40000, workingCapitalVariance: 0 },
  { weekStart: "2026-06-22", deposits: 0, expenses: 0, operatingProfit: 0, startingCash: 40000, endingCash: -5000, startingAvailCredit: 0, endingAvailCredit: 0, workingCapital: -5000, workingCapitalVariance: 0 },
] };

const INPUT = {
  pnlLines: [ line("revenue", "income", 1000000, 500000), line("cogs", "other_direct", 600000, 250000), line("oh", "indirect_fixed", 300000, 200000) ],
  breakEven: { netRevenue: 500000, totalVariable: 250000, totalFixed: 200000, profitGoal: 100000 },
  overhead: { totalDirect: 1000, totalIndirect: 600 },
  cashFlow,
  currentWeekIndex: 0,
  salesPlanYtd: 1000000, salesActualYtd: 500000, reforecastYearEnd: 900000,
  loadedLaborRate: 42.5,
  lastQbSyncAt: null,
  reconc: { sbuBudgetSum: 1000000, annualPlan: 1000000, seasonalityWeightSum: 1 },
};

describe("computeFinanceOverview", () => {
  it("rolls up cash, P&L, break-even, sales, rates from one place", () => {
    const o = computeFinanceOverview(INPUT);
    expect(o.cashOnHand).toBeCloseTo(40000, 2);
    expect(o.grossMarginPct).toBeCloseTo(0.5, 4);
    expect(o.overheadRate).toBeCloseTo(0.6, 4);
    expect(o.loadedLaborRate).toBe(42.5);
    expect(o.salesPacePct).toBeCloseTo(0.5, 4);
  });
  it("computes runway as weeks until ending cash goes non-positive", () => {
    expect(computeFinanceOverview(INPUT).runwayWeeks).toBe(2);
  });
  it("raises alerts for negative runway and missing QB sync", () => {
    const o = computeFinanceOverview(INPUT);
    expect(o.alerts.some((a) => a.toLowerCase().includes("cash"))).toBe(true);
    expect(o.alerts.some((a) => a.toLowerCase().includes("quickbooks"))).toBe(true);
  });
  it("has no spurious cash alert when healthy", () => {
    const healthy = { ...INPUT,
      cashFlow: { weeks: [{ ...cashFlow.weeks[0], endingCash: 80000, workingCapital: 80000 }, { ...cashFlow.weeks[1], endingCash: 90000, workingCapital: 90000 }] },
      lastQbSyncAt: "2999-01-01T00:00:00Z",
    };
    const o = computeFinanceOverview(healthy);
    expect(o.alerts.some((a) => a.toLowerCase().includes("cash"))).toBe(false);
  });
});
