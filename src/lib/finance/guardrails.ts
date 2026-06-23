export function checkReconciliation(args: {
  sbuBudgetSum: number;
  annualPlan: number;
  seasonalityWeightSum: number;
  quotePrice: number | null;
  loadedBreakeven: number | null;
}): string[] {
  const warnings: string[] = [];
  if (Math.abs(args.sbuBudgetSum - args.annualPlan) > 1) {
    warnings.push(`Business-unit budgets ($${Math.round(args.sbuBudgetSum).toLocaleString()}) don't equal the company plan ($${Math.round(args.annualPlan).toLocaleString()}).`);
  }
  if (Math.abs(args.seasonalityWeightSum - 1) > 0.001) {
    warnings.push(`Seasonality weights total ${(args.seasonalityWeightSum * 100).toFixed(1)}%, not 100%.`);
  }
  if (args.quotePrice != null && args.loadedBreakeven != null && args.quotePrice < args.loadedBreakeven) {
    warnings.push(`Quote price ($${args.quotePrice.toLocaleString()}) is below the overhead-loaded breakeven ($${args.loadedBreakeven.toLocaleString()}).`);
  }
  return warnings;
}
