import { describe, it, expect } from "vitest";
import { checkReconciliation } from "@/lib/finance/guardrails";

// Generic figures (repo is public).
describe("checkReconciliation", () => {
  it("flags SBU budgets that don't sum to the company plan", () => {
    const w = checkReconciliation({ sbuBudgetSum: 900000, annualPlan: 1000000, seasonalityWeightSum: 1, quotePrice: null, loadedBreakeven: null });
    expect(w.some((m) => m.toLowerCase().includes("business-unit"))).toBe(true);
  });
  it("flags seasonality weights that don't total 100%", () => {
    const w = checkReconciliation({ sbuBudgetSum: 1000000, annualPlan: 1000000, seasonalityWeightSum: 0.9, quotePrice: null, loadedBreakeven: null });
    expect(w.some((m) => m.toLowerCase().includes("seasonality"))).toBe(true);
  });
  it("flags a quote priced below the overhead-loaded breakeven", () => {
    const w = checkReconciliation({ sbuBudgetSum: 1000000, annualPlan: 1000000, seasonalityWeightSum: 1, quotePrice: 100, loadedBreakeven: 120 });
    expect(w.some((m) => m.toLowerCase().includes("breakeven"))).toBe(true);
  });
  it("returns no warnings when everything reconciles", () => {
    expect(checkReconciliation({ sbuBudgetSum: 1000000, annualPlan: 1000000, seasonalityWeightSum: 1, quotePrice: 200, loadedBreakeven: 120 })).toEqual([]);
  });
});
