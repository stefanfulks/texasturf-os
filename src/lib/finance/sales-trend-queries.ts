import { createClient } from "@/lib/supabase/server";
import type { SeasonalityInput } from "@/lib/finance/types";

export async function getBusinessUnits() {
  const supabase = await createClient();
  const { data } = await supabase.from("fin_business_unit").select("*").eq("active", true).order("display_order");
  return data ?? [];
}

export async function getSeasonalityInput(businessUnitId: string): Promise<SeasonalityInput> {
  const supabase = await createClient();
  const { data } = await supabase.from("fin_seasonality").select("*").eq("business_unit_id", businessUnitId);
  const byYear = new Map<number, { year: number; weightPct: number; monthly: number[] }>();
  for (const row of data ?? []) {
    if (!byYear.has(row.history_year)) byYear.set(row.history_year, { year: row.history_year, weightPct: Number(row.year_weight_pct), monthly: Array(12).fill(0) });
    byYear.get(row.history_year)!.monthly[row.month - 1] = Number(row.history_amount);
  }
  return { years: [...byYear.values()].sort((a, b) => a.year - b.year) };
}

export async function getActuals(businessUnitId: string, fiscalYear: number): Promise<(number | null)[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("fin_sales_actual").select("month, amount").eq("business_unit_id", businessUnitId).eq("fiscal_year", fiscalYear);
  const out: (number | null)[] = Array(12).fill(null);
  for (const row of data ?? []) out[row.month - 1] = Number(row.amount);
  return out;
}
