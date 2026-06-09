/**
 * Role gate for server actions and route handlers.
 *
 * Usage:
 *   import { requireOfficeOrAdmin } from "@/lib/auth/require-role";
 *
 *   export async function createWidget(formData: FormData) {
 *     await requireOfficeOrAdmin();
 *     // ... mutation
 *   }
 *
 * Throws AuthRequiredError if no signed-in user, RoleRequiredError if their
 * profile.role isn't in the allowed set. Both surface as a plain Error to the
 * client (Next.js translates thrown errors in server actions to a generic
 * failure), which is the right UX — we don't want to leak "you're field role"
 * back to the page.
 */

import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "office" | "field";

export class AuthRequiredError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "AuthRequiredError";
  }
}

export class RoleRequiredError extends Error {
  constructor(allowed: readonly AppRole[]) {
    super(`Requires role ${allowed.join(" or ")}`);
    this.name = "RoleRequiredError";
  }
}

/**
 * Resolve the signed-in user's profile.role and require it to be one of
 * `allowed`. Returns the resolved user id + role so callers don't have to
 * re-query.
 */
export async function requireRole(
  allowed: readonly AppRole[],
): Promise<{ userId: string; role: AppRole }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthRequiredError();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role as AppRole | undefined;
  if (!role || !allowed.includes(role)) {
    throw new RoleRequiredError(allowed);
  }

  return { userId: user.id, role };
}

export const ADMIN_ONLY = ["admin"] as const;
export const OFFICE_OR_ADMIN = ["admin", "office"] as const;

export const requireAdmin = () => requireRole(ADMIN_ONLY);
export const requireOfficeOrAdmin = () => requireRole(OFFICE_OR_ADMIN);
