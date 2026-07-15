/**
 * QuickBooks P&L actuals → fin_account_value.
 *
 * Pulls the ProfitAndLoss report summarized by month, resolves each QB
 * account to the finance chart of accounts via fin_qb_account_map, and
 * upserts actual_amount per (account, month period). Unmapped QB accounts
 * roll into the seeded 'unmapped' fin_account and are named in the sync log
 * so they can be mapped in /admin/finance/settings.
 *
 * Idempotent: re-running a month overwrites the same (account_id, period_id)
 * rows. Runs on the service-role client — never in a user-reachable path.
 */

import { qbFetch } from "../api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logSync } from "./log";

// The QBO report payload is a recursive Section/Data row tree.
type QbColData = { value?: string; id?: string };
type QbReportRow = {
  type?: string;
  ColData?: QbColData[];
  Rows?: { Row?: QbReportRow[] };
  Header?: { ColData?: QbColData[] };
  Summary?: { ColData?: QbColData[] };
};
type QbReport = {
  Header?: { Option?: { Name: string; Value: string }[] };
  Columns?: { Column?: { ColTitle?: string; ColType?: string; MetaData?: { Name: string; Value: string }[] }[] };
  Rows?: { Row?: QbReportRow[] };
};

/** Walk the row tree, yielding leaf data rows (one per QB account). */
function* dataRows(rows: QbReportRow[] | undefined): Generator<QbReportRow> {
  for (const row of rows ?? []) {
    if (row.type === "Data" && row.ColData) yield row;
    if (row.Rows?.Row) yield* dataRows(row.Rows.Row);
  }
}

async function ensureMonthPeriodIds(fiscalYear: number): Promise<Map<number, string>> {
  const sb = supabaseAdmin();
  const { data: existing, error } = await sb
    .from("fin_period")
    .select("id, month")
    .eq("grain", "month")
    .eq("fiscal_year", fiscalYear);
  if (error) throw new Error(`fin_period read failed: ${error.message}`);
  const have = new Map<number, string>((existing ?? []).map((p) => [p.month as number, p.id as string]));
  const missing = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => !have.has(m));
  if (missing.length) {
    const { error: insErr } = await sb.from("fin_period").insert(
      missing.map((m) => ({ grain: "month", fiscal_year: fiscalYear, month: m, quarter: Math.ceil(m / 3) })),
    );
    if (insErr) throw new Error(`fin_period insert failed: ${insErr.message}`);
    const { data: all } = await sb
      .from("fin_period")
      .select("id, month")
      .eq("grain", "month")
      .eq("fiscal_year", fiscalYear);
    for (const p of all ?? []) have.set(p.month as number, p.id as string);
  }
  return have;
}

export type PnlSyncResult = { rows: number; unmapped: string[] };

export async function syncPnlActuals(
  realmId: string,
  opts: { startDate: string; endDate: string },
): Promise<PnlSyncResult> {
  try {
    const report = (await qbFetch(realmId, "/reports/ProfitAndLoss", {
      start_date: opts.startDate,
      end_date: opts.endDate,
      summarize_column_by: "Month",
      accounting_method: "Accrual",
    })) as QbReport;

    // Month columns carry a StartDate in their MetaData; the leading
    // "Account" column and trailing "Total" column don't — skip those.
    const columns = report.Columns?.Column ?? [];
    const monthByCol = new Map<number, { fiscalYear: number; month: number }>();
    columns.forEach((col, i) => {
      const start = col.MetaData?.find((m) => m.Name === "StartDate")?.Value;
      if (!start) return;
      const d = new Date(`${start}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return;
      monthByCol.set(i, { fiscalYear: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
    });
    if (monthByCol.size === 0) {
      await logSync("pnl_actuals", "ok", 0, "no month columns in report (no data in range)");
      return { rows: 0, unmapped: [] };
    }

    const sb = supabaseAdmin();
    const { data: mapRows, error: mapErr } = await sb
      .from("fin_qb_account_map")
      .select("qb_account_id, qb_account_name, fin_account_id")
      .eq("active", true);
    if (mapErr) throw new Error(`fin_qb_account_map read failed: ${mapErr.message}`);
    const byQbId = new Map<string, string>();
    const byQbName = new Map<string, string>();
    for (const m of mapRows ?? []) {
      if (m.qb_account_id) byQbId.set(m.qb_account_id as string, m.fin_account_id as string);
      byQbName.set((m.qb_account_name as string).toLowerCase(), m.fin_account_id as string);
    }

    // Sum per (fin_account, fiscalYear, month). Multiple QB accounts can map
    // to one fin_account, so aggregation happens before the upsert.
    const sums = new Map<string, number>(); // "finAccountId|year|month" -> amount
    const unmapped = new Set<string>();
    for (const row of dataRows(report.Rows?.Row)) {
      const cols = row.ColData ?? [];
      const name = cols[0]?.value?.trim();
      if (!name) continue;
      const qbId = cols[0]?.id;
      let finId = (qbId && byQbId.get(qbId)) || byQbName.get(name.toLowerCase());
      if (!finId) {
        unmapped.add(name);
        finId = "unmapped";
      }
      for (const [colIdx, period] of monthByCol) {
        const raw = cols[colIdx]?.value;
        if (raw === undefined || raw === "") continue;
        const amount = Number(raw);
        if (!Number.isFinite(amount) || amount === 0) continue;
        const key = `${finId}|${period.fiscalYear}|${period.month}`;
        sums.set(key, (sums.get(key) ?? 0) + amount);
      }
    }

    const fiscalYears = new Set<number>();
    for (const key of sums.keys()) fiscalYears.add(Number(key.split("|")[1]));
    const periodIds = new Map<string, string>(); // "year|month" -> period_id
    for (const fy of fiscalYears) {
      const months = await ensureMonthPeriodIds(fy);
      for (const [m, id] of months) periodIds.set(`${fy}|${m}`, id);
    }

    const upserts = Array.from(sums, ([key, amount]) => {
      const [finId, year, month] = key.split("|");
      const periodId = periodIds.get(`${year}|${month}`);
      if (!periodId) throw new Error(`missing fin_period for ${year}-${month}`);
      return {
        account_id: finId,
        period_id: periodId,
        actual_amount: Math.round(amount * 100) / 100,
        source: "quickbooks",
      };
    });

    if (upserts.length) {
      const { error: upErr } = await sb
        .from("fin_account_value")
        .upsert(upserts, { onConflict: "account_id,period_id" });
      if (upErr) throw new Error(`fin_account_value upsert failed: ${upErr.message}`);
    }

    const message = unmapped.size
      ? `unmapped QB accounts → 'unmapped': ${Array.from(unmapped).sort().join(", ")}`
      : undefined;
    await logSync("pnl_actuals", "ok", upserts.length, message);
    return { rows: upserts.length, unmapped: Array.from(unmapped).sort() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logSync("pnl_actuals", "error", 0, msg);
    throw err;
  }
}
