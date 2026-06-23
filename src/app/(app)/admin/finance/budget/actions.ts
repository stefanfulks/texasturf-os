"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ensureMonthPeriods } from "@/lib/finance/budget-queries";

export async function saveAccountValue(accountId: string, periodId: string, basis: "budget" | "actual", amount: number) {
  await requireAdmin();
  const supabase = await createClient();
  const patch = basis === "budget" ? { budget_amount: amount } : { actual_amount: amount };
  const { error } = await supabase.from("fin_account_value").upsert(
    { account_id: accountId, period_id: periodId, ...patch },
    { onConflict: "account_id,period_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/budget");
}

export async function autoSeedDraft(fiscalYear: number) {
  await requireAdmin();
  const supabase = await createClient();
  const periodIds = await ensureMonthPeriods(fiscalYear);
  const { data: settings } = await supabase.from("fin_company_settings").select("annual_revenue_plan").eq("fiscal_year", fiscalYear).single();
  const monthlyRevenue = Number(settings?.annual_revenue_plan ?? 0) / 12;
  const rows = periodIds.flatMap((pid) => [
    { account_id: "revenue", period_id: pid, budget_amount: monthlyRevenue },
    { account_id: "cogs_materials", period_id: pid, budget_amount: monthlyRevenue * 0.30 },
    { account_id: "subcontractor", period_id: pid, budget_amount: monthlyRevenue * 0.25 },
  ]);
  const { error } = await supabase.from("fin_account_value").upsert(rows, { onConflict: "account_id,period_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/budget");
}
