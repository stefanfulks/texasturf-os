import { describe, it, expect } from "vitest";
import { computeSeasonality, computeSalesTrend } from "@/lib/finance/sales-trend";

describe("computeSeasonality", () => {
  it("weights years and normalizes to 100%", () => {
    const r = computeSeasonality({ years: [
      { year: 2024, weightPct: 0.9, monthly: Array(12).fill(100) },
      { year: 2025, weightPct: 0.1, monthly: Array(12).fill(200) },
    ] });
    expect(r.weightedAvg[0]).toBeCloseTo(110, 6);
    expect(r.pctOfYearly[0]).toBeCloseTo(1 / 12, 6);
    expect(r.pctOfYearly.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
  it("falls back to a simple average when no weights are set", () => {
    const r = computeSeasonality({ years: [
      { year: 2024, weightPct: 0, monthly: Array(12).fill(100) },
      { year: 2025, weightPct: 0, monthly: Array(12).fill(200) },
    ] });
    expect(r.weightedAvg[0]).toBeCloseTo(150, 6);
  });
});

describe("computeSalesTrend", () => {
  const seasonality = { weightedAvg: Array(12).fill(100), pctOfYearly: Array(12).fill(1 / 12) };
  it("spreads the budget and tracks cumulative actual", () => {
    const r = computeSalesTrend({ annualBudget: 1200, seasonality, actuals: [120, 80, ...Array(10).fill(null)] });
    expect(r.monthlyBudget[0]).toBeCloseTo(100, 6);
    expect(r.cumulativeBudget[1]).toBeCloseTo(200, 6);
    expect(r.cumulativeActual[1]).toBeCloseTo(200, 6);
    expect(r.cumulativeActual[5]).toBeCloseTo(200, 6);
    expect(r.attainmentPct[1]).toBeCloseTo(1, 6);
    expect(r.monthlyVariance[0]).toBeCloseTo(20, 6);
  });
  it("reforecast-to-goal redistributes the gap and lands on the goal", () => {
    const r = computeSalesTrend({ annualBudget: 1200, seasonality, actuals: [120, 80, ...Array(10).fill(null)] });
    expect(r.reforecastToGoal[2]).toBeCloseTo(100, 6);
    expect(r.reforecastToGoal.reduce((a, b) => a + b, 0)).toBeCloseTo(1200, 4);
  });
  it("reforecast-run-rate projects remaining months at the latest attainment", () => {
    const r = computeSalesTrend({ annualBudget: 1200, seasonality, actuals: [120, 80, ...Array(10).fill(null)] });
    expect(r.reforecastRunRate[2]).toBeCloseTo(100, 6);
  });
  it("computes YoY variance when last year is supplied", () => {
    const r = computeSalesTrend({ annualBudget: 1200, seasonality, actuals: [120, ...Array(11).fill(null)], lastYearMonthly: [100, ...Array(11).fill(0)] });
    expect(r.varianceVsLastYear[0]).toBeCloseTo(0.2, 6);
  });
});
