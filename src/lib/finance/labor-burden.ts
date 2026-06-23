import Decimal from "decimal.js";
import type { EmployeeComp, BurdenRates, LaborBurdenResult } from "@/lib/finance/types";

export function computeLaborBurden(
  emp: EmployeeComp,
  rates: BurdenRates,
  currentUtil: number,
  goalUtil: number,
): LaborBurdenResult {
  const grossHours = new Decimal(emp.weeksPerYear).times(emp.hoursPerWeek);
  const dailyHours = new Decimal(emp.hoursPerWeek).div(5); // 5-day week (work_days_per_week)
  const daysOff = new Decimal(emp.ptoDays).plus(emp.sickDays).plus(emp.vacationDays).plus(emp.holidayDays).plus(emp.shutdownDays);
  const netAvailableHours = grossHours.minus(daysOff.times(dailyHours));

  const wage = emp.payType === "hourly" ? new Decimal(emp.currentPay).times(grossHours) : new Decimal(emp.currentPay);
  const otPay = new Decimal(emp.annualOtHours).times(emp.payType === "hourly" ? new Decimal(emp.currentPay).times(1.5) : 0);
  const bonus = new Decimal(emp.bonusAnnual);
  const benefits = new Decimal(emp.benefitsAnnual);

  const isW2 = emp.taxClass === "W2";
  const fica = isW2 ? Decimal.min(wage, rates.ficaCap).times(rates.ficaRate) : new Decimal(0);
  const medicare = isW2 ? wage.times(rates.medicareRate) : new Decimal(0);
  const futa = isW2 ? Decimal.min(wage, rates.futaCap).times(rates.futaRate) : new Decimal(0);
  const suta = isW2 ? Decimal.min(wage, rates.sutaCap).times(rates.sutaRate) : new Decimal(0);
  const employerTaxes = fica.plus(medicare).plus(futa).plus(suta);
  const workersComp = isW2 ? wage.div(100).times(rates.wcRatePer100) : new Decimal(0);

  const totalAnnualCost = wage.plus(otPay).plus(bonus).plus(employerTaxes).plus(workersComp).plus(benefits);
  const lbr100 = netAvailableHours.isZero() ? new Decimal(0) : totalAnnualCost.div(netAvailableHours);
  const lbrCurrent = currentUtil > 0 ? lbr100.div(currentUtil) : new Decimal(0);
  const lbrGoal = goalUtil > 0 ? lbr100.div(goalUtil) : new Decimal(0);

  return {
    totalAnnualCost: totalAnnualCost.toNumber(),
    grossHours: grossHours.toNumber(),
    netAvailableHours: netAvailableHours.toNumber(),
    lbr100: lbr100.toNumber(),
    lbrCurrent: lbrCurrent.toNumber(),
    lbrGoal: lbrGoal.toNumber(),
    employerTaxes: employerTaxes.toNumber(),
    workersComp: workersComp.toNumber(),
    benefits: benefits.toNumber(),
  };
}

export function blendedCrewRate(results: LaborBurdenResult[], which: "lbr100" | "lbrCurrent" | "lbrGoal"): number {
  if (results.length === 0) return 0;
  const sum = results.reduce((acc, r) => acc + r[which], 0);
  return sum / results.length;
}
