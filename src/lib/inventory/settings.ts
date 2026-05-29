/**
 * Inventory settings reader — pulls all key/value rows from inv_settings
 * and exposes a typed accessor. Settings are stored as JSONB so values
 * can be strings, numbers, nulls, booleans, etc.
 */

import { createClient } from "@/lib/supabase/server";

export type InventorySettings = {
  default_receiving_location_id: string | null;
  low_stock_threshold_factor: number;
  auto_archive_completed_jobs_after_days: number | null;
};

const DEFAULTS: InventorySettings = {
  default_receiving_location_id: null,
  low_stock_threshold_factor: 1.5,
  auto_archive_completed_jobs_after_days: null,
};

export async function loadInventorySettings(): Promise<InventorySettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inv_settings")
    .select("key, value");

  if (error || !data) {
    return { ...DEFAULTS };
  }

  const map = new Map<string, unknown>();
  for (const row of data) {
    map.set((row as { key: string; value: unknown }).key, (row as { key: string; value: unknown }).value);
  }

  const out: InventorySettings = { ...DEFAULTS };

  const loc = map.get("default_receiving_location_id");
  if (typeof loc === "string" && loc.length > 0) out.default_receiving_location_id = loc;

  const factor = map.get("low_stock_threshold_factor");
  if (typeof factor === "number" && Number.isFinite(factor)) out.low_stock_threshold_factor = factor;

  const days = map.get("auto_archive_completed_jobs_after_days");
  if (typeof days === "number" && Number.isFinite(days)) out.auto_archive_completed_jobs_after_days = days;

  return out;
}
