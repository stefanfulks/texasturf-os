import { describe, it, expect } from "vitest";
import { computeCashFlow } from "@/lib/finance/cash-flow";

const weeks = ["2026-06-08", "2026-06-15", "2026-06-22"];

describe("computeCashFlow", () => {
  it("chains the cash waterfall across weeks", () => {
    const r = computeCashFlow({
      weekStarts: weeks, openingCash: 100000, openingAvailCredit: 200000, creditLimit: 250000,
      ar: [{ expectedReceiptDate: "2026-06-16", openBalance: 50000 }],
      ap: [
        { expectedPayDate: "2026-06-09", openBalance: 30000, paymentType: "cash" },
        { expectedPayDate: "2026-06-17", openBalance: 10000, paymentType: "credit" },
      ],
      recurring: [], weeklyActuals: {},
    });
    expect(r.weeks[0].endingCash).toBeCloseTo(70000, 2);
    expect(r.weeks[0].endingAvailCredit).toBeCloseTo(200000, 2);
    expect(r.weeks[1].deposits).toBeCloseTo(50000, 2);
    expect(r.weeks[1].endingCash).toBeCloseTo(120000, 2);
    expect(r.weeks[1].endingAvailCredit).toBeCloseTo(190000, 2);
    expect(r.weeks[1].workingCapital).toBeCloseTo(310000, 2);
    expect(r.weeks[1].workingCapitalVariance).toBeCloseTo(40000, 2);
  });

  it("keeps working capital = ending cash + ending available credit every week", () => {
    const r = computeCashFlow({ weekStarts: weeks, openingCash: 50000, openingAvailCredit: 10000, creditLimit: 50000, ar: [], ap: [], recurring: [], weeklyActuals: {} });
    for (const w of r.weeks) expect(w.workingCapital).toBeCloseTo(w.endingCash + w.endingAvailCredit, 6);
  });

  it("expands a monthly recurring cost into the week it falls", () => {
    const r = computeCashFlow({
      weekStarts: weeks, openingCash: 10000, openingAvailCredit: 0, creditLimit: 0,
      ar: [], ap: [], recurring: [{ frequency: "monthly", lastPaymentDate: "2026-05-15", amount: 1000 }], weeklyActuals: {},
    });
    expect(r.weeks[1].expenses).toBeCloseTo(1000, 2);
    expect(r.weeks[0].expenses).toBeCloseTo(0, 2);
  });

  it("adds sales-forecast deposits to the weeks they fall in", () => {
    const r = computeCashFlow({
      weekStarts: weeks, openingCash: 0, openingAvailCredit: 0, creditLimit: 0,
      ar: [], ap: [], recurring: [], weeklyActuals: {},
      salesForecastWeekly: { "2026-06-15": 25000 },
    });
    expect(r.weeks[1].deposits).toBeCloseTo(25000, 2);
    expect(r.weeks[0].deposits).toBeCloseTo(0, 2);
  });
});
