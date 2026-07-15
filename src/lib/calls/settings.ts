import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * call_settings is key/value jsonb (mirrors inv_settings). Well-known keys:
 *   record_announcement (boolean) — play "this call may be recorded" to the
 *   customer before bridging. Default ON: Texas is one-party consent, but
 *   out-of-state callees may not be.
 */
export const RECORD_ANNOUNCEMENT_KEY = "record_announcement";

export async function getRecordAnnouncement(
  sb: SupabaseClient<Database>,
): Promise<boolean> {
  const { data } = await sb
    .from("call_settings")
    .select("value")
    .eq("key", RECORD_ANNOUNCEMENT_KEY)
    .maybeSingle();
  const value = (data as { value: unknown } | null)?.value;
  // Fail safe: missing/unreadable → announce.
  return value === false ? false : true;
}
