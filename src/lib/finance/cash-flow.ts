import Decimal from "decimal.js";
import type { CashWeek, CashFlowResult } from "@/lib/finance/types";

type CashFlowArgs = {
  weekStarts: string[];
  openingCash: number;
  openingAvailCredit: number;
  creditLimit: number;
  ar: { expectedReceiptDate: string; openBalance: number }[];
  ap: { expectedPayDate: string; openBalance: number; paymentType: "cash" | "credit" }[];
  recurring: { frequency: string; lastPaymentDate: string; amount: number }[];
  weeklyActuals: Record<string, { deposits: number; expenses: number }>;
  salesForecastWeekly?: Record<string, number>;
};

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function inRange(iso: string, start: string, endExcl: string): boolean {
  return iso >= start && iso < endExcl;
}

function recurringInRange(freq: string, lastPaymentDate: string, start: string, endExcl: string): number {
  if (freq === "daily") {
    let n = 0;
    for (let i = 0; i < 7; i++) if (inRange(addDaysISO(start, i), start, endExcl)) n++;
    return n;
  }
  if (freq === "weekly") return 1;
  const stepDays = freq === "biweekly" ? 14 : 0;
  const stepMonths = freq === "monthly" ? 1 : freq === "quarterly" ? 3 : freq === "annually" ? 12 : 0;
  let cur = lastPaymentDate;
  let count = 0;
  for (let i = 0; i < 1200; i++) {
    cur = stepDays ? addDaysISO(cur, stepDays) : addMonthsISO(cur, stepMonths);
    if (cur >= endExcl) break;
    if (inRange(cur, start, endExcl)) count++;
  }
  return count;
}

export function computeCashFlow(args: CashFlowArgs): CashFlowResult {
  const weeks: CashWeek[] = [];
  let prevCash = new Decimal(args.openingCash);
  let prevCredit = new Decimal(args.openingAvailCredit);
  let prevWorkingCapital = new Decimal(args.openingCash).plus(args.openingAvailCredit);

  for (const weekStart of args.weekStarts) {
    const endExcl = addDaysISO(weekStart, 7);
    const actuals = args.weeklyActuals[weekStart] ?? { deposits: 0, expenses: 0 };

    const arDeposits = args.ar.filter((a) => inRange(a.expectedReceiptDate, weekStart, endExcl)).reduce((s, a) => s.plus(a.openBalance), new Decimal(0));
    const forecastDeposit = args.salesForecastWeekly?.[weekStart] ?? 0;
    const deposits = arDeposits.plus(actuals.deposits).plus(forecastDeposit);

    const apCash = args.ap.filter((b) => b.paymentType === "cash" && inRange(b.expectedPayDate, weekStart, endExcl)).reduce((s, b) => s.plus(b.openBalance), new Decimal(0));
    const apCredit = args.ap.filter((b) => b.paymentType === "credit" && inRange(b.expectedPayDate, weekStart, endExcl)).reduce((s, b) => s.plus(b.openBalance), new Decimal(0));
    const recurring = args.recurring.reduce((s, r) => s.plus(new Decimal(r.amount).times(recurringInRange(r.frequency, r.lastPaymentDate, weekStart, endExcl))), new Decimal(0));

    const cashExpenses = apCash.plus(recurring).plus(actuals.expenses);
    const creditExpenses = apCredit;
    const expenses = cashExpenses.plus(creditExpenses);
    const operatingProfit = deposits.minus(expenses);

    const startingCash = prevCash;
    const endingCash = startingCash.plus(deposits).minus(cashExpenses);
    const startingAvailCredit = prevCredit;
    const endingAvailCredit = startingAvailCredit.minus(creditExpenses);
    const workingCapital = endingCash.plus(endingAvailCredit);
    const workingCapitalVariance = workingCapital.minus(prevWorkingCapital);

    weeks.push({
      weekStart,
      deposits: deposits.toNumber(),
      expenses: expenses.toNumber(),
      operatingProfit: operatingProfit.toNumber(),
      startingCash: startingCash.toNumber(),
      endingCash: endingCash.toNumber(),
      startingAvailCredit: startingAvailCredit.toNumber(),
      endingAvailCredit: endingAvailCredit.toNumber(),
      workingCapital: workingCapital.toNumber(),
      workingCapitalVariance: workingCapitalVariance.toNumber(),
    });

    prevCash = endingCash;
    prevCredit = endingAvailCredit;
    prevWorkingCapital = workingCapital;
  }

  return { weeks };
}
