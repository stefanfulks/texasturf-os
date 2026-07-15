import { supabaseAdmin } from "@/lib/supabase/admin";

export type SyncEntity = "pnl_actuals" | "ar" | "ap" | "cash";

/**
 * One fin_sync_log row per entity per run. The finance cockpit reads the
 * latest row to show "QuickBooks synced <date>" and flag stale (≥2 days).
 */
export async function logSync(
  entity: SyncEntity,
  status: "ok" | "error",
  rowsSynced: number,
  message?: string,
): Promise<void> {
  const { error } = await supabaseAdmin().from("fin_sync_log").insert({
    source: "quickbooks",
    entity,
    status,
    rows_synced: rowsSynced,
    message: message ?? null,
  });
  if (error) {
    // Logging must never mask the sync result itself.
    console.error(`fin_sync_log insert failed (${entity}): ${error.message}`);
  }
}
