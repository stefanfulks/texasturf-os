import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Batch-sign screenshot paths from the private `feedback` bucket into
 * temporary view URLs — one storage round-trip for a whole page of feedback
 * rows. Returns a `path → signedUrl` map; any path that can't be signed is
 * simply omitted. Server-only (needs the user-context or service client).
 */
export async function signFeedbackPaths(
  supabase: SupabaseClient<Database>,
  paths: string[],
  expiresIn = 60 * 60, // 1 hour — long enough for a page view
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return map;

  const { data } = await supabase.storage.from("feedback").createSignedUrls(unique, expiresIn);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}
