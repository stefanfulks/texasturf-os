import type { PnlLine } from "@/lib/finance/types";

type Totals = { grossProfit: number; grossMarginPct: number; totalOperatingIncome: number; netIncome: number };
const SECTIONS = ["income", "other_direct", "indirect_fixed", "other_income", "other_expense"] as const;

function side(lines: PnlLine[], key: "budget" | "actual"): Totals {
  const sum = (s: PnlLine["section"]) => lines.filter((l) => l.section === s).reduce((a, l) => a + l[key], 0);
  const income = sum("income");
  const direct = sum("other_direct");
  const indirect = sum("indirect_fixed");
  const otherIncome = sum("other_income");
  const otherExpense = sum("other_expense");
  const grossProfit = income - direct;
  const totalOperatingIncome = grossProfit - indirect;
  return {
    grossProfit,
    grossMarginPct: income > 0 ? grossProfit / income : 0,
    totalOperatingIncome,
    netIncome: totalOperatingIncome + otherIncome - otherExpense,
  };
}

export function rollupPnl(lines: PnlLine[]): {
  budget: Totals; actual: Totals; variance: Totals;
  bySection: Record<string, { budget: number; actual: number; variance: number }>;
} {
  const budget = side(lines, "budget");
  const actual = side(lines, "actual");
  const variance: Totals = {
    grossProfit: actual.grossProfit - budget.grossProfit,
    grossMarginPct: actual.grossMarginPct - budget.grossMarginPct,
    totalOperatingIncome: actual.totalOperatingIncome - budget.totalOperatingIncome,
    netIncome: actual.netIncome - budget.netIncome,
  };
  const bySection: Record<string, { budget: number; actual: number; variance: number }> = {};
  for (const s of SECTIONS) {
    const b = lines.filter((l) => l.section === s).reduce((a, l) => a + l.budget, 0);
    const a = lines.filter((l) => l.section === s).reduce((acc, l) => acc + l.actual, 0);
    bySection[s] = { budget: b, actual: a, variance: a - b };
  }
  return { budget, actual, variance, bySection };
}
