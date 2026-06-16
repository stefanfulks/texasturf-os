"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DEPARTMENTS } from "@/lib/departments";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated" as const };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { user, error: "Admin only" as const };
  }
  return { user, error: null as null | string };
}

export type UpdateUserState = { error: string | null; success: boolean };

const updateUserSchema = z.object({
  user_id:     z.string().uuid(),
  role:        z.enum(["admin", "office", "field"]),
  departments: z.array(z.enum(DEPARTMENTS)),
});

export async function updateUser(
  _prev: UpdateUserState,
  formData: FormData,
): Promise<UpdateUserState> {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false };

  // departments come in as a comma-separated string from a hidden field
  const deptStr = (formData.get("departments") as string | null) ?? "";
  const departments = deptStr.split(",").map((s) => s.trim()).filter(Boolean);

  const parsed = updateUserSchema.safeParse({
    user_id:     formData.get("user_id"),
    role:        formData.get("role"),
    departments,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  // Don't allow demoting yourself out of admin — sanity check
  if (parsed.data.user_id === auth.user.id && parsed.data.role !== "admin") {
    return { error: "You can't remove your own admin role.", success: false };
  }

  const { error } = await supabase.from("profiles").update({
    role:        parsed.data.role,
    department:  parsed.data.departments[0] ?? null,
    departments: parsed.data.departments,
    updated_at:  new Date().toISOString(),
  } as never).eq("id", parsed.data.user_id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/admin/users");
  return { error: null, success: true };
}

// ─── Invite a new user ────────────────────────────────────────────────────────
//
// Internal team app: everyone has an @texasturfusa.com Google account, so we
// don't email an invite link. We create the account with a confirmed email and
// set their role; Supabase auto-links their Google identity on first sign-in
// (confirmed email = safe to link), landing them on the role assigned here.

export type InviteUserState = { error: string | null; success: boolean; sentTo: string | null };

const inviteSchema = z.object({
  email:       z.string().email("Valid email required"),
  full_name:   z.string().optional(),
  role:        z.enum(["admin", "office", "field"]).default("field"),
  departments: z.array(z.enum(DEPARTMENTS)).default([]),
});

export async function inviteUser(
  _prev: InviteUserState,
  formData: FormData,
): Promise<InviteUserState> {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false, sentTo: null };

  const deptStr = (formData.get("departments") as string | null) ?? "";
  const departments = deptStr.split(",").map((s) => s.trim()).filter(Boolean);

  const parsed = inviteSchema.safeParse({
    email:       (formData.get("email") as string | null)?.trim().toLowerCase(),
    full_name:   (formData.get("full_name") as string | null) || undefined,
    role:        formData.get("role") || "field",
    departments,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false, sentTo: null };
  }
  if (!parsed.data.email.endsWith("@texasturfusa.com")) {
    return { error: "Email must be @texasturfusa.com", success: false, sentTo: null };
  }

  let service;
  try {
    service = createServiceClient();
  } catch (err) {
    return {
      error: `Service-role client unavailable. Set SUPABASE_SERVICE_ROLE_KEY in Vercel env. Detail: ${
        err instanceof Error ? err.message : String(err)
      }`,
      success: false,
      sentTo: null,
    };
  }

  // Already in the system? Just (re)assign their role + departments.
  const { data: existing } = await service.from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (existing) {
    const { error: updErr } = await service.from("profiles").update({
      role:        parsed.data.role,
      department:  parsed.data.departments[0] ?? null,
      departments: parsed.data.departments,
      ...(parsed.data.full_name ? { full_name: parsed.data.full_name } : {}),
      updated_at:  new Date().toISOString(),
    } as never).eq("id", (existing as { id: string }).id);
    if (updErr) return { error: updErr.message, success: false, sentTo: null };
    revalidatePath("/admin/users");
    revalidatePath("/team");
    return { error: null, success: true, sentTo: parsed.data.email };
  }

  // New teammate: create a confirmed account (no password). They sign in with
  // their @texasturfusa.com Google account — no email needed.
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email:         parsed.data.email,
    email_confirm: true,
    user_metadata: {
      full_name:  parsed.data.full_name ?? null,
      invited_by: auth.user.id,
    },
  });
  if (createErr || !created?.user) {
    return {
      error: createErr?.message ?? "Failed to create the account.",
      success: false,
      sentTo: null,
    };
  }
  const newUserId = created.user.id;

  // Set their role + departments so they land ready on first sign-in.
  const { error: profileErr } = await service.from("profiles").upsert({
    id:          newUserId,
    email:       parsed.data.email,
    full_name:   parsed.data.full_name ?? null,
    role:        parsed.data.role,
    department:  parsed.data.departments[0] ?? null,
    departments: parsed.data.departments,
  } as never, { onConflict: "id" });
  if (profileErr) {
    // Roll back the auth user so the admin can retry cleanly.
    await service.auth.admin.deleteUser(newUserId).catch(() => {});
    return {
      error: `Couldn't set role/departments: ${profileErr.message}. Rolled back — try again.`,
      success: false,
      sentTo: null,
    };
  }

  revalidatePath("/admin/users");
  revalidatePath("/team");
  return { error: null, success: true, sentTo: parsed.data.email };
}

// ─── Remove a user ────────────────────────────────────────────────────────────

export type RemoveUserState = { error: string | null; success: boolean };

export async function removeUser(
  _prev: RemoveUserState,
  formData: FormData,
): Promise<RemoveUserState> {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false };

  const userId = formData.get("user_id") as string | null;
  if (!userId) return { error: "user_id required", success: false };
  if (userId === auth.user.id) return { error: "You can't delete yourself.", success: false };

  // Service-role admin deletion — cascades the auth.users row + ON DELETE
  // CASCADE on profiles wipes the profile too.
  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) return { error: error.message, success: false };

  revalidatePath("/admin/users");
  return { error: null, success: true };
}
