import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Batch-sign private `pitch-photos` paths into temporary view URLs — one
 * storage round-trip for a whole documentation page. Returns a
 * `path → signedUrl` map; unsignable paths are omitted. Server-only.
 * (Mirror of signFeedbackPaths, pointed at the pitch-photos bucket.)
 */
export async function signPitchPhotoPaths(
  supabase: SupabaseClient<Database>,
  paths: string[],
  expiresIn = 60 * 60,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return map;
  const { data } = await supabase.storage.from("pitch-photos").createSignedUrls(unique, expiresIn);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}
