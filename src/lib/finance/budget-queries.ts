import { createClient } from "@/lib/supabase/server";
import type { PnlLine } from "@/lib/finance/types";

export async function ensureMonthPeriods(fiscalYear: number): Promise<string[]> {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("fin_period").select("id, month").eq("grain", "month").eq("fiscal_year", fiscalYear);
  const have = new Map((existing ?? []).map((p) => [p.month, p.id]));
  const missing = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => !have.has(m));
  if (missing.length) {
    await supabase.from("fin_period").insert(missing.map((m) => ({ grain: "month", fiscal_year: fiscalYear, month: m, quarter: Math.ceil(m / 3) })));
  }
  const { data: all } = await supabase.from("fin_period").select("id, month").eq("grain", "month").eq("fiscal_year", fiscalYear).order("month");
  return (all ?? []).map((p) => p.id);
}

export type BudgetRow = {
  account: { id: string; name: string; section: PnlLine["section"]; cost_behavior: "variable" | "fixed"; direct_type: string };
  budget: number[]; actual: number[];
};

export async function getBudgetMatrix(fiscalYear: number): Promise<{ periodIds: string[]; rows: BudgetRow[] }> {
  const supabase = await createClient();
  const periodIds = await ensureMonthPeriods(fiscalYear);
  const [{ data: accounts }, { data: values }] = await Promise.all([
    supabase.from("fin_account").select("*").eq("active", true).order("sort_order"),
    supabase.from("fin_account_value").select("account_id, period_id, budget_amount, actual_amount").in("period_id", periodIds),
  ]);
  const idx = new Map(periodIds.map((id, i) => [id, i]));
  const rows: BudgetRow[] = (accounts ?? []).map((a) => ({
    account: { id: a.id, name: a.name, section: a.section as PnlLine["section"], cost_behavior: a.cost_behavior as "variable" | "fixed", direct_type: a.direct_type },
    budget: Array(12).fill(0), actual: Array(12).fill(0),
  }));
  const byId = new Map(rows.map((r) => [r.account.id, r]));
  for (const v of values ?? []) {
    const r = byId.get(v.account_id); const i = idx.get(v.period_id);
    if (r && i != null) { r.budget[i] = Number(v.budget_amount); r.actual[i] = Number(v.actual_amount); }
  }
  return { periodIds, rows };
}
