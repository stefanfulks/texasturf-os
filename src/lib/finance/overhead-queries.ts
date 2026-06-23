import { createClient } from "@/lib/supabase/server";
import type { OverheadInput } from "@/lib/finance/types";

export async function getOverheadInputs(fiscalYear = 2026): Promise<OverheadInput & { revenue: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fin_account_value")
    .select("actual_amount, account:account_id(section), period:period_id(fiscal_year)")
    .eq("period.fiscal_year", fiscalYear);

  let totalDirect = 0, totalIndirect = 0, revenue = 0;
  for (const row of data ?? []) {
    const section = (row as { account?: { section?: string } | null }).account?.section;
    const amt = Number(row.actual_amount ?? 0);
    if (section === "other_direct") totalDirect += amt;
    else if (section === "indirect_fixed") totalIndirect += amt;
    else if (section === "income") revenue += amt;
  }
  return { totalDirect, totalIndirect, revenue };
}
