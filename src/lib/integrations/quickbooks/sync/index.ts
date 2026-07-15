/**
 * Orchestrates a QuickBooks → finance backbone sync run. Shared by the
 * manual sync route, the Vercel cron, and the settings "Sync now" action.
 * Each entity logs its own fin_sync_log row (inside the writers); one entity
 * failing must not stop the rest.
 */

import * as Sentry from "@sentry/nextjs";
import { getConnectedRealm } from "../tokens";
import { syncPnlActuals } from "./pnl";
import { syncArInvoices } from "./ar";
import { syncApBills } from "./ap";
import { syncCashSnapshot } from "./cash";

export type SyncRunEntity = "pnl" | "ar" | "ap" | "cash" | "all";
export type SyncRunResult = {
  ok: boolean;
  connected: boolean;
  synced: Record<string, { rows: number; error: string | null }>;
  range: { startDate: string; endDate: string };
};

export async function runQuickbooksSync(
  entity: SyncRunEntity,
  year?: number,
): Promise<SyncRunResult> {
  const now = new Date();
  const fy = year ?? now.getUTCFullYear();
  // Fiscal year to date (calendar-year fiscal year, matching fin_period).
  const startDate = `${fy}-01-01`;
  const endDate = fy === now.getUTCFullYear() ? now.toISOString().slice(0, 10) : `${fy}-12-31`;
  const range = { startDate, endDate };

  const realm = await getConnectedRealm();
  if (!realm) {
    return { ok: false, connected: false, synced: {}, range };
  }

  const synced: SyncRunResult["synced"] = {};
  if (entity === "pnl" || entity === "all") {
    synced.pnl_actuals = await run(
      async () => (await syncPnlActuals(realm.realm_id, range)).rows,
      "pnl_actuals",
    );
  }
  if (entity === "ar" || entity === "all") {
    synced.ar = await run(() => syncArInvoices(realm.realm_id), "ar");
  }
  if (entity === "ap" || entity === "all") {
    synced.ap = await run(() => syncApBills(realm.realm_id), "ap");
  }
  if (entity === "cash" || entity === "all") {
    synced.cash = await run(() => syncCashSnapshot(realm.realm_id), "cash");
  }

  const failed = Object.values(synced).filter((r) => r.error).length;
  return { ok: failed === 0, connected: true, synced, range };
}

async function run(
  fn: () => Promise<number>,
  entity: string,
): Promise<{ rows: number; error: string | null }> {
  try {
    return { rows: await fn(), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { sync: "quickbooks", entity } });
    return { rows: 0, error: message };
  }
}
