import Decimal from "decimal.js";
import type { OverheadInput, OverheadResult, JobPricingInput, JobPricingResult } from "@/lib/finance/types";

const LADDER = [2, 5, 7, 10, 15, 20];

export function computeOverhead(input: OverheadInput): OverheadResult {
  const direct = new Decimal(input.totalDirect);
  const indirect = new Decimal(input.totalIndirect);
  const absorptionRate = direct.isZero() ? new Decimal(0) : indirect.div(direct);
  return {
    absorptionRate: absorptionRate.toNumber(),
    breakEvenRevenue: direct.plus(indirect).toNumber(),
  };
}

export function priceJob(input: JobPricingInput): JobPricingResult {
  const actualCost = new Decimal(input.material).plus(input.burdenedLabor).plus(input.subcontract).plus(input.shipping);
  const loaded = actualCost.times(new Decimal(1).plus(input.absorptionRate));
  const priceLadder = LADDER.map((m) => ({
    marginPct: m,
    price: loaded.div(new Decimal(1).minus(m / 100)).toNumber(),
  }));
  return { actualCost: actualCost.toNumber(), loadedBreakevenCost: loaded.toNumber(), priceLadder };
}
