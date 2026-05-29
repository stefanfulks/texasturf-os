/**
 * Service-role Supabase client.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY and bypasses Row-Level Security.
 * ONLY use from trusted server contexts (webhooks, cron jobs, server
 * actions that have already authenticated the caller out-of-band).
 * Never expose this client or its key to the browser.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var",
    );
  }
  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
