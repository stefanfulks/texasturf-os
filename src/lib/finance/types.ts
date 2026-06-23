export type Money = number;
export type Rate  = number;

export type EmployeeComp = {
  name: string;
  payType: "hourly" | "salary";
  currentPay: number;
  isBillable: boolean;
  taxClass: "W2" | "1099";
  state: string;
  wcCategory: string;
  benefitsAnnual: number;
  annualOtHours: number;
  bonusAnnual: number;
  weeksPerYear: number;
  hoursPerWeek: number;
  ptoDays: number;
  sickDays: number;
  vacationDays: number;
  holidayDays: number;
  shutdownDays: number;
};

export type BurdenRates = {
  ficaRate: number; ficaCap: number;
  medicareRate: number;
  futaRate: number; futaCap: number;
  sutaRate: number; sutaCap: number;
  wcRatePer100: number;
};

export type LaborBurdenResult = {
  totalAnnualCost: number;
  grossHours: number;
  netAvailableHours: number;
  lbr100: number;
  lbrCurrent: number;
  lbrGoal: number;
  employerTaxes: number;
  workersComp: number;
  benefits: number;
};

export type PnlLine = {
  accountId: string;
  name: string;
  section: "income" | "other_direct" | "indirect_fixed" | "other_income" | "other_expense";
  costBehavior: "variable" | "fixed";
  directType: "direct_labor" | "direct_materials" | "subcontractor" | "other_direct" | "na";
  budget: number;
  actual: number;
  variance: number;
};

export type BreakEvenInput  = { netRevenue: number; totalFixed: number; totalVariable: number; profitGoal: number };
export type BreakEvenResult = {
  contributionMarginPct: number; fixedCostRatio: number;
  breakEvenRevenue: number; profitGoalRevenue: number;
  monthlyTarget: number; weeklyTarget: number; dailyTarget: number;
};

export type SeasonalityInput  = { years: { year: number; weightPct: number; monthly: number[] }[] };
export type SeasonalityResult = { weightedAvg: number[]; pctOfYearly: number[] };

export type SalesTrendInput  = { annualBudget: number; seasonality: SeasonalityResult; actuals: (number | null)[]; lastYearMonthly?: number[] };
export type SalesTrendResult = {
  monthlyBudget: number[]; cumulativeBudget: number[]; cumulativeActual: number[];
  attainmentPct: number[]; varianceVsBudget: number[]; varianceVsLastYear: number[];
  monthlyVariance: number[]; cumulativeVariance: number[];
  reforecastToGoal: number[]; reforecastRunRate: number[];
};

export type OverheadInput   = { totalDirect: number; totalIndirect: number };
export type OverheadResult  = { absorptionRate: number; breakEvenRevenue: number };
export type JobPricingInput = { material: number; burdenedLabor: number; subcontract: number; shipping: number; absorptionRate: number };
export type JobPricingResult = { actualCost: number; loadedBreakevenCost: number; priceLadder: { marginPct: number; price: number }[] };

export type CashWeek = {
  weekStart: string; deposits: number; expenses: number; operatingProfit: number;
  startingCash: number; endingCash: number;
  startingAvailCredit: number; endingAvailCredit: number;
  workingCapital: number; workingCapitalVariance: number;
};
export type CashFlowResult = { weeks: CashWeek[] };
