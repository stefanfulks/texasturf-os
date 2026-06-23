import { createClient } from "@/lib/supabase/server";
import type { EmployeeComp, BurdenRates } from "@/lib/finance/types";

export async function getUtilization(fiscalYear = 2026): Promise<{ current: number; goal: number }> {
  const supabase = await createClient();
  const { data } = await supabase.from("fin_company_settings").select("current_utilization, goal_utilization").eq("fiscal_year", fiscalYear).single();
  return { current: Number(data?.current_utilization ?? 0.75), goal: Number(data?.goal_utilization ?? 0.85) };
}

export async function getBurdenRate(fiscalYear: number, state: string, wcCategory: string): Promise<BurdenRates> {
  const supabase = await createClient();
  const { data } = await supabase.from("fin_burden_rate").select("*").eq("fiscal_year", fiscalYear).eq("state", state).eq("wc_category", wcCategory).maybeSingle();
  return {
    ficaRate: Number(data?.fica_rate ?? 0.062), ficaCap: Number(data?.fica_cap ?? 176100),
    medicareRate: Number(data?.medicare_rate ?? 0.0145),
    futaRate: Number(data?.futa_rate ?? 0.06), futaCap: Number(data?.futa_cap ?? 7000),
    sutaRate: Number(data?.suta_rate ?? 0), sutaCap: Number(data?.suta_cap ?? 0),
    wcRatePer100: Number(data?.wc_rate_per_100 ?? 0),
  };
}

export async function getEmployees(): Promise<{ id: string; roleName: string | null; comp: EmployeeComp }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fin_employee")
    .select("*, role:role_id(name)")
    .eq("active", true)
    .order("name");
  return (data ?? []).map((e) => ({
    id: e.id,
    roleName: (e as { role?: { name: string } | null }).role?.name ?? null,
    comp: {
      name: e.name, payType: e.pay_type as "hourly" | "salary", currentPay: Number(e.current_pay),
      isBillable: e.is_billable, taxClass: e.tax_classification as "W2" | "1099", state: e.state,
      wcCategory: e.wc_category ?? "default", benefitsAnnual: Number(e.benefits_annual),
      annualOtHours: Number(e.annual_ot_hours), bonusAnnual: Number(e.bonus_annual),
      weeksPerYear: Number(e.weeks_per_year), hoursPerWeek: Number(e.hours_per_week),
      ptoDays: Number(e.pto_days), sickDays: Number(e.sick_days), vacationDays: Number(e.vacation_days),
      holidayDays: Number(e.holiday_days), shutdownDays: Number(e.shutdown_days),
    },
  }));
}
