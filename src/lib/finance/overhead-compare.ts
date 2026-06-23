import Decimal from "decimal.js";
import type { QuoteResult } from "@/lib/pricing/calculator";

export function compareQuoteWithOverhead(quote: QuoteResult, absorptionRate: number, targetMargin: number): {
  currentPrice: number | null;
  loadedCost: number;
  overheadAmount: number;
  priceAtSameMargin: number | null;
  marginIfPriceHeld: number | null;
} {
  const cogs = new Decimal(quote.cogs);
  const overheadAmount = cogs.times(absorptionRate);
  const loadedCost = cogs.plus(overheadAmount);
  const m = new Decimal(targetMargin).div(100);
  const priceAtSameMargin = m.gte(1) ? null : loadedCost.div(new Decimal(1).minus(m)).toNumber();
  const marginIfPriceHeld =
    quote.price == null || quote.price === 0
      ? null
      : new Decimal(quote.price).minus(loadedCost).div(quote.price).toNumber();
  return {
    currentPrice: quote.price,
    loadedCost: loadedCost.toNumber(),
    overheadAmount: overheadAmount.toNumber(),
    priceAtSameMargin,
    marginIfPriceHeld,
  };
}
