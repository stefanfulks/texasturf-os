import { redirect } from "next/navigation";
import { createClient as _createClient } from "@/lib/supabase/server";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Auth + role gate for inventory server actions.
 *
 * Returns `{ user, profile }` on success or `{ error }` for the action to
 * propagate back as the form state. Field role is read-only on the entire
 * inventory surface — only admin and office can mutate.
 *
 * Usage:
 *   const auth = await requireOfficeOrAdmin(supabase);
 *   if (!auth.user) return { error: auth.error, success: false };
 */
export async function requireOfficeOrAdmin(supabase: Supabase): Promise<
  | { user: { id: string }; profile: { role: string }; error?: undefined }
  | { user?: undefined; profile?: undefined; error: string }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "office"].includes(profile.role)) {
    return { error: "Only admin and office can perform this action" };
  }
  return { user: { id: user.id }, profile: { role: profile.role } };
}

/**
 * Page-level guard for mutation pages. Redirects field users back to the
 * inventory dashboard. Call at the top of a server component before any data
 * fetches that the page wouldn't need to render for non-admin/office.
 */
export async function redirectIfNotOfficeOrAdmin(): Promise<void> {
  const supabase = await _createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) redirect("/inventory");
}
