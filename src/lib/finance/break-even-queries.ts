import { createClient } from "@/lib/supabase/server";
import type { BreakEvenInput } from "@/lib/finance/types";

export async function getBreakEvenInputs(fiscalYear = 2026): Promise<BreakEvenInput> {
  const supabase = await createClient();
  const [{ data: settings }, { data: goal }, { data: values }] = await Promise.all([
    supabase.from("fin_company_settings").select("annual_revenue_plan").eq("fiscal_year", fiscalYear).single(),
    supabase.from("fin_profit_goal").select("*").eq("fiscal_year", fiscalYear).maybeSingle(),
    supabase.from("fin_account_value").select("actual_amount, account:account_id(cost_behavior, section), period:period_id(fiscal_year)").eq("period.fiscal_year", fiscalYear),
  ]);

  let totalVariable = 0, totalFixed = 0, incomeActual = 0;
  for (const row of values ?? []) {
    const acct = (row as { account?: { cost_behavior?: string; section?: string } | null }).account;
    const amt = Number(row.actual_amount ?? 0);
    if (acct?.section === "income") { incomeActual += amt; continue; }
    if (acct?.cost_behavior === "variable") totalVariable += amt;
    else if (acct?.cost_behavior === "fixed") totalFixed += amt;
  }

  const profitGoal =
    Number(goal?.taxes ?? 0) + Number(goal?.current_lt_debt ?? 0) + Number(goal?.growth ?? 0) +
    Number(goal?.capex ?? 0) + Number(goal?.distributions ?? 0);

  const netRevenue = incomeActual > 0 ? incomeActual : Number(settings?.annual_revenue_plan ?? 0);
  return { netRevenue, totalVariable, totalFixed, profitGoal };
}
