import { describe, it, expect } from "vitest";
import { rollupPnl } from "@/lib/finance/pnl";
import type { PnlLine } from "@/lib/finance/types";

// Generic figures (repo is public). Real-workbook validation is in the private
// plan docs; here we prove the P&L rollup with non-identifying numbers.
const line = (accountId: string, section: PnlLine["section"], budget: number, actual: number): PnlLine =>
  ({ accountId, name: accountId, section, costBehavior: section === "income" ? "variable" : "fixed", directType: "na", budget, actual, variance: actual - budget });

const LINES: PnlLine[] = [
  line("revenue",  "income",         1000000, 500000),
  line("cogs",     "other_direct",    600000, 250000),
  line("overhead", "indirect_fixed",  300000, 200000),
  line("other_exp","other_expense",    50000,  40000),
];

describe("rollupPnl", () => {
  it("rolls up the budget block (40% gross margin, net income 50,000)", () => {
    const r = rollupPnl(LINES);
    expect(r.budget.grossProfit).toBeCloseTo(400000, 2);
    expect(r.budget.grossMarginPct).toBeCloseTo(0.4, 4);
    expect(r.budget.totalOperatingIncome).toBeCloseTo(100000, 2);
    expect(r.budget.netIncome).toBeCloseTo(50000, 2);
  });
  it("rolls up the actual block (50% gross margin, net income 10,000)", () => {
    const r = rollupPnl(LINES);
    expect(r.actual.grossMarginPct).toBeCloseTo(0.5, 4);
    expect(r.actual.netIncome).toBeCloseTo(10000, 2);
  });
  it("derives variance as actual minus budget", () => {
    const r = rollupPnl(LINES);
    expect(r.variance.netIncome).toBeCloseTo(10000 - 50000, 2);
  });
  it("subtotals by section", () => {
    const r = rollupPnl(LINES);
    expect(r.bySection.other_direct.budget).toBeCloseTo(600000, 2);
    expect(r.bySection.other_direct.variance).toBeCloseTo(250000 - 600000, 2);
  });
});
