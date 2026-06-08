/**
 * Untyped service-role Supabase client (bypasses RLS).
 *
 * Imported from the npm variant's Jobber + warehouse modules. It is intentionally
 * untyped so those modules build before their tables exist in `database.types.ts`.
 *
 * TODO(merge): once the Jobber/warehouse migrations are applied and
 * `database.types.ts` is regenerated, replace `supabaseAdmin()` usages with the
 * typed `createServiceClient()` from `@/lib/supabase/service` and delete this file.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseAdmin() {
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase server env missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
