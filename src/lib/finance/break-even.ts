import Decimal from "decimal.js";
import type { BreakEvenInput, BreakEvenResult } from "@/lib/finance/types";

export function computeBreakEven(input: BreakEvenInput): BreakEvenResult {
  const rev = new Decimal(input.netRevenue);
  const variable = new Decimal(input.totalVariable);
  const fixed = new Decimal(input.totalFixed);
  const cm = rev.isZero() ? new Decimal(0) : new Decimal(1).minus(variable.div(rev));
  const fixedRatio = rev.isZero() ? new Decimal(0) : fixed.div(rev);
  const breakEven = cm.lte(0) ? new Decimal(0) : fixed.div(cm);
  const profitGoalRevenue = cm.lte(0) ? new Decimal(0) : fixed.plus(input.profitGoal).div(cm);
  return {
    contributionMarginPct: cm.toNumber(),
    fixedCostRatio: fixedRatio.toNumber(),
    breakEvenRevenue: breakEven.toNumber(),
    profitGoalRevenue: profitGoalRevenue.toNumber(),
    monthlyTarget: profitGoalRevenue.div(12).toNumber(),
    weeklyTarget: profitGoalRevenue.div(52).toNumber(),
    dailyTarget: profitGoalRevenue.div(365).toNumber(),
  };
}
