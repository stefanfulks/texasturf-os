import { createClient } from "@/lib/supabase/server";

export async function getCashFlowData() {
  const supabase = await createClient();
  const [{ data: ar }, { data: ap }, { data: recurring }, { data: settings }, { data: lastSnap }] = await Promise.all([
    supabase.from("fin_ar_invoice").select("expected_receipt_date, open_balance").not("expected_receipt_date", "is", null).neq("result", "paid"),
    supabase.from("fin_ap_bill").select("expected_pay_date, open_balance, payment_type").not("expected_pay_date", "is", null),
    supabase.from("fin_recurring_cost").select("frequency, last_payment_date, amount").not("last_payment_date", "is", null),
    supabase.from("fin_company_settings").select("total_credit_limit").eq("fiscal_year", 2026).single(),
    supabase.from("fin_cash_snapshot").select("ending_cash, ending_avail_credit, total_credit_limit").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    ar: (ar ?? []).map((r) => ({ expectedReceiptDate: r.expected_receipt_date as string, openBalance: Number(r.open_balance) })),
    ap: (ap ?? []).map((b) => ({ expectedPayDate: b.expected_pay_date as string, openBalance: Number(b.open_balance), paymentType: b.payment_type as "cash" | "credit" })),
    recurring: (recurring ?? []).map((r) => ({ frequency: r.frequency, lastPaymentDate: r.last_payment_date as string, amount: Number(r.amount) })),
    openingCash: Number(lastSnap?.ending_cash ?? 0),
    openingAvailCredit: Number(lastSnap?.ending_avail_credit ?? settings?.total_credit_limit ?? 0),
    creditLimit: Number(settings?.total_credit_limit ?? 0),
  };
}

export async function getScorecard() {
  const supabase = await createClient();
  const { data: metrics } = await supabase.from("fin_metric").select("*").order("sort_order");
  const { data: values } = await supabase.from("fin_metric_value").select("metric_id, target_value, actual_value");
  const latest = new Map((values ?? []).map((v) => [v.metric_id, v]));
  return (metrics ?? []).map((m) => ({ ...m, target: Number(latest.get(m.id)?.target_value ?? 0), actual: Number(latest.get(m.id)?.actual_value ?? 0) }));
}
