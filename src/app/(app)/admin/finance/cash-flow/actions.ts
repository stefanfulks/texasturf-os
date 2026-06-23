"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function closeWeek(weekStartMonday: string, endingCash: number, endingAvailCredit: number, creditLimit: number) {
  await requireAdmin();
  const supabase = await createClient();
  const fy = Number(weekStartMonday.slice(0, 4));
  // Find-or-create the week period (fin_period uses an expression unique index, so no upsert onConflict).
  let { data: period } = await supabase.from("fin_period")
    .select("id").eq("grain", "week").eq("fiscal_year", fy).eq("week_start_monday", weekStartMonday).maybeSingle();
  if (!period) {
    const ins = await supabase.from("fin_period")
      .insert({ grain: "week", fiscal_year: fy, week_start_monday: weekStartMonday, is_closed: true })
      .select("id").single();
    period = ins.data;
  }
  if (!period) throw new Error("Could not create week period");
  const { error } = await supabase.from("fin_cash_snapshot").upsert({
    period_id: period.id, ending_cash: endingCash, ending_avail_credit: endingAvailCredit,
    total_credit_limit: creditLimit, working_capital: endingCash + endingAvailCredit,
  }, { onConflict: "period_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/finance/cash-flow");
}
