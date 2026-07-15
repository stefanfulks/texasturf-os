/**
 * QuickBooks cash position → fin_cash_snapshot.
 *
 * Upserts the current week's snapshot (week-grain fin_period, on conflict
 * period_id — mirrors the manual closeWeek action in
 * src/app/(app)/admin/finance/cash-flow/actions.ts):
 *   * ending_cash        = sum of Bank account CurrentBalance
 *   * total_credit_limit = carried forward from the latest snapshot (QBO's
 *                          API doesn't expose credit limits — set it once by
 *                          closing a week manually and the sync keeps it)
 *   * ending_avail_credit = total_credit_limit − Credit Card balances owed
 *   * working_capital    = ending_cash + ending_avail_credit
 *
 * Service-role client only — never in a user-reachable path.
 */

import { qbQueryAll } from "../api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logSync } from "./log";

type QbAccount = {
  Id: string;
  Name?: string;
  AccountType?: string;
  CurrentBalance?: number;
};

/** Monday (YYYY-MM-DD) of the current week in the company's timezone. */
function currentWeekStartMonday(): string {
  const today = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) + "T00:00:00Z",
  );
  const dow = today.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dow + 6) % 7;
  today.setUTCDate(today.getUTCDate() - daysSinceMonday);
  return today.toISOString().slice(0, 10);
}

export async function syncCashSnapshot(realmId: string): Promise<number> {
  try {
    const [banks, cards] = await Promise.all([
      qbQueryAll<QbAccount>(realmId, "Account", "AccountType = 'Bank'"),
      qbQueryAll<QbAccount>(realmId, "Account", "AccountType = 'Credit Card'"),
    ]);
    const endingCash = round2(banks.reduce((sum, a) => sum + (a.CurrentBalance ?? 0), 0));
    // QBO reports credit card CurrentBalance as the amount owed.
    const creditOwed = round2(cards.reduce((sum, a) => sum + (a.CurrentBalance ?? 0), 0));

    const sb = supabaseAdmin();
    const { data: latest } = await sb
      .from("fin_cash_snapshot")
      .select("total_credit_limit")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const creditLimit = Number(latest?.total_credit_limit ?? 0);
    const availCredit = round2(Math.max(creditLimit - creditOwed, 0));

    const weekStartMonday = currentWeekStartMonday();
    const fy = Number(weekStartMonday.slice(0, 4));
    let { data: period } = await sb
      .from("fin_period")
      .select("id")
      .eq("grain", "week")
      .eq("fiscal_year", fy)
      .eq("week_start_monday", weekStartMonday)
      .maybeSingle();
    if (!period) {
      const ins = await sb
        .from("fin_period")
        .insert({ grain: "week", fiscal_year: fy, week_start_monday: weekStartMonday })
        .select("id")
        .single();
      period = ins.data;
    }
    if (!period) throw new Error(`Could not create week period ${weekStartMonday}`);

    const { error } = await sb.from("fin_cash_snapshot").upsert(
      {
        period_id: period.id,
        ending_cash: endingCash,
        ending_avail_credit: availCredit,
        total_credit_limit: creditLimit,
        working_capital: round2(endingCash + availCredit),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "period_id" },
    );
    if (error) throw new Error(`fin_cash_snapshot upsert failed: ${error.message}`);

    const note =
      creditLimit === 0
        ? "total_credit_limit is 0 — close a week manually once in Cash Flow to seed it"
        : undefined;
    await logSync("cash", "ok", 1, note);
    return 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logSync("cash", "error", 0, msg);
    throw err;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
