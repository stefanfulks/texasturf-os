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

  // Use the service-role admin API to invite. This creates the auth.users
  // row (if it doesn't already exist) and sends a magic-link invite email.
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";

  // Detect "already exists" up front so we return a clear message instead
  // of letting the invite API surface a generic 500.
  const { data: existing } = await service.from("profiles")
    .select("id, email, role")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (existing) {
    return {
      error: `${parsed.data.email} is already in the system as ${(existing as { role?: string }).role ?? "a user"}. Edit them directly from the table below instead of re-inviting.`,
      success: false,
      sentTo: null,
    };
  }

  const { data: invited, error: inviteErr } = await service.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        full_name: parsed.data.full_name ?? null,
        invited_by: auth.user.id,
      },
      redirectTo: `${appUrl}/onboarding/department`,
    },
  );
  if (inviteErr || !invited?.user) {
    const raw = inviteErr?.message ?? "Failed to send invite";
    // Make common Supabase errors actionable
    let friendly = raw;
    if (/already (registered|been )?(invited|exists)/i.test(raw)) {
      friendly = `${parsed.data.email} already has an account. Edit them in the table below.`;
    } else if (/SMTP/i.test(raw) || /email|smtp/i.test(raw)) {
      friendly = `Supabase couldn't send the invite email — check Project Settings → Auth → SMTP. Original: ${raw}`;
    } else if (/redirect/i.test(raw)) {
      friendly = `Redirect URL not allowed. Add ${appUrl}/onboarding/department under Supabase → Auth → URL Configuration → Redirect URLs. Original: ${raw}`;
    }
    return { error: friendly, success: false, sentTo: null };
  }

  // Upsert the profile row with the desired role + departments. The signup
  // trigger may have created an empty profile already; this fills it in.
  const { error: profileErr } = await service.from("profiles").upsert({
    id:          invited.user.id,
    email:       parsed.data.email,
    full_name:   parsed.data.full_name ?? null,
    role:        parsed.data.role,
    department:  parsed.data.departments[0] ?? null,
    departments: parsed.data.departments,
  } as never, { onConflict: "id" });

  if (profileErr) {
    return {
      error: `Invite sent to ${parsed.data.email} but failed to set role/departments: ${profileErr.message}. Edit the row in the table once they've signed in.`,
      success: false,
      sentTo: parsed.data.email,
    };
  }

  revalidatePath("/admin/users");
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
