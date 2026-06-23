import { describe, it, expect } from "vitest";
import { computeBreakEven } from "@/lib/finance/break-even";

// Generic figures (repo is public). Real-workbook anchors are validated in the
// private plan docs; here we prove the CVP formulas with non-identifying numbers.
const INPUT = { netRevenue: 1000000, totalVariable: 600000, totalFixed: 300000, profitGoal: 100000 };

describe("computeBreakEven", () => {
  it("computes contribution margin and fixed-cost ratio", () => {
    const r = computeBreakEven(INPUT);
    expect(r.contributionMarginPct).toBeCloseTo(0.4, 6);   // 1 - 600000/1000000
    expect(r.fixedCostRatio).toBeCloseTo(0.3, 6);           // 300000/1000000
  });
  it("computes plain break-even revenue = fixed / contribution margin", () => {
    expect(computeBreakEven(INPUT).breakEvenRevenue).toBeCloseTo(750000, 2); // 300000/0.4
  });
  it("computes profit-goal break-even = (fixed + goal) / contribution margin", () => {
    expect(computeBreakEven(INPUT).profitGoalRevenue).toBeCloseTo(1000000, 2); // 400000/0.4
  });
  it("computes required pace per period", () => {
    const r = computeBreakEven(INPUT);
    expect(r.monthlyTarget).toBeCloseTo(r.profitGoalRevenue / 12, 6);
    expect(r.weeklyTarget).toBeCloseTo(r.profitGoalRevenue / 52, 6);
    expect(r.dailyTarget).toBeCloseTo(r.profitGoalRevenue / 365, 6);
  });
  it("guards a zero contribution margin", () => {
    const r = computeBreakEven({ netRevenue: 1000, totalVariable: 1000, totalFixed: 500, profitGoal: 0 });
    expect(r.breakEvenRevenue).toBe(0);
  });
});
