import { describe, it, expect } from "vitest";
import { computeLaborBurden, blendedCrewRate } from "@/lib/finance/labor-burden";
import type { EmployeeComp, BurdenRates } from "@/lib/finance/types";

// Generic figures (repo is public). Proves the burden formulas with a made-up
// $25/hr worker; real-employee validation lives in the private plan docs.
const RATES: BurdenRates = {
  ficaRate: 0.062, ficaCap: 176100,
  medicareRate: 0.0145,
  futaRate: 0.06, futaCap: 7000,
  sutaRate: 0.026, sutaCap: 9000,
  wcRatePer100: 5.0,
};

const EMP: EmployeeComp = {
  name: "Test Worker", payType: "hourly", currentPay: 25, isBillable: true,
  taxClass: "W2", state: "TX", wcCategory: "default",
  benefitsAnnual: 0, annualOtHours: 0, bonusAnnual: 0,
  weeksPerYear: 52, hoursPerWeek: 40,
  ptoDays: 10, sickDays: 0, vacationDays: 0, holidayDays: 5, shutdownDays: 0,
};

describe("computeLaborBurden", () => {
  it("computes net available hours from gross minus days off", () => {
    const r = computeLaborBurden(EMP, RATES, 0.75, 0.85);
    expect(r.grossHours).toBe(2080);
    expect(r.netAvailableHours).toBe(1960); // 2080 - 15*8
  });
  it("computes employer taxes and workers comp on the base wage", () => {
    const r = computeLaborBurden(EMP, RATES, 0.75, 0.85);
    // wage = 25*2080 = 52000
    // FICA 0.062*52000=3224; Medicare 0.0145*52000=754; FUTA 0.06*7000=420;
    // SUTA 0.026*9000=234; WC 52000/100*5=2600
    expect(r.employerTaxes).toBeCloseTo(3224 + 754 + 420 + 234, 2);
    expect(r.workersComp).toBeCloseTo(2600, 2);
    expect(r.totalAnnualCost).toBeCloseTo(52000 + 4632 + 2600, 2); // 59232
  });
  it("derives LBR at 100% then scales by utilization", () => {
    const r = computeLaborBurden(EMP, RATES, 0.75, 0.85);
    expect(r.lbr100).toBeCloseTo(59232 / 1960, 2);
    expect(r.lbrCurrent).toBeCloseTo(r.lbr100 / 0.75, 4);
    expect(r.lbrGoal).toBeCloseTo(r.lbr100 / 0.85, 4);
  });
  it("excludes 1099 contractors from taxes and workers comp", () => {
    const r = computeLaborBurden({ ...EMP, taxClass: "1099" }, RATES, 0.75, 0.85);
    expect(r.employerTaxes).toBe(0);
    expect(r.workersComp).toBe(0);
    expect(r.totalAnnualCost).toBeCloseTo(52000, 2);
  });
  it("blendedCrewRate averages the chosen rate across the crew", () => {
    const a = computeLaborBurden(EMP, RATES, 0.75, 0.85);
    const b = computeLaborBurden({ ...EMP, currentPay: 35 }, RATES, 0.75, 0.85);
    expect(blendedCrewRate([a, b], "lbr100")).toBeCloseTo((a.lbr100 + b.lbr100) / 2, 4);
  });
});
