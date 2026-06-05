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

  // Up-front dup check on profiles so we return a clear message instead of
  // letting the auth API surface a generic 500.
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

  // Step 1: create the auth.users row WITHOUT triggering Supabase's
  // (rate-limited) built-in invite email. Just an empty unconfirmed user.
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email:         parsed.data.email,
    email_confirm: false,
    user_metadata: {
      full_name:  parsed.data.full_name ?? null,
      invited_by: auth.user.id,
    },
  });
  if (createErr || !created?.user) {
    return {
      error: createErr?.message ?? "Failed to create user record",
      success: false,
      sentTo: null,
    };
  }
  const newUserId = created.user.id;

  // Step 2: upsert the profile with the chosen role + departments BEFORE
  // sending the invite link, so the row is ready when they sign in.
  const { error: profileErr } = await service.from("profiles").upsert({
    id:          newUserId,
    email:       parsed.data.email,
    full_name:   parsed.data.full_name ?? null,
    role:        parsed.data.role,
    department:  parsed.data.departments[0] ?? null,
    departments: parsed.data.departments,
  } as never, { onConflict: "id" });
  if (profileErr) {
    // Roll back the auth user so the admin can retry cleanly
    await service.auth.admin.deleteUser(newUserId).catch(() => {});
    return {
      error: `Couldn't set role/departments for new user: ${profileErr.message}. Rolled back.`,
      success: false,
      sentTo: null,
    };
  }

  // Step 3: generate a magic-link the user can click to set up their account.
  const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
    type:        "magiclink",
    email:       parsed.data.email,
    options:     { redirectTo: `${appUrl}/onboarding/department` },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    await service.auth.admin.deleteUser(newUserId).catch(() => {});
    return {
      error: `Couldn't generate sign-in link: ${linkErr?.message ?? "unknown"}. Rolled back.`,
      success: false,
      sentTo: null,
    };
  }
  const inviteLink = linkData.properties.action_link;

  // Step 4: send the invite via Resend (we control the deliverability,
  // not Supabase's free-tier email throttle).
  const sendResult = await sendInviteEmail({
    to:           parsed.data.email,
    name:         parsed.data.full_name ?? parsed.data.email.split("@")[0],
    inviterName:  auth.user.id, // we'll resolve to a real name below
    inviteLink,
  }, service);
  if (!sendResult.ok) {
    return {
      error: `User created but invite email failed: ${sendResult.detail}. The link is: ${inviteLink}`,
      success: true,
      sentTo: parsed.data.email,
    };
  }

  revalidatePath("/admin/users");
  revalidatePath("/team");
  return { error: null, success: true, sentTo: parsed.data.email };
}

// ─── Invite email via Resend ─────────────────────────────────────────────────

async function sendInviteEmail(
  args: { to: string; name: string; inviterName: string; inviteLink: string },
  service: ReturnType<typeof createServiceClient>,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, detail: "RESEND_API_KEY not set in Vercel env" };
  }
  const from = process.env.EMAIL_FROM ?? `TexasTurf OS <noreply@${process.env.RESEND_FROM_DOMAIN ?? "texasturfusa.com"}>`;

  // Look up the inviter's full name for a nicer email
  const { data: inviter } = await service.from("profiles")
    .select("full_name, email")
    .eq("id", args.inviterName)
    .single();
  const inviterDisplay = (inviter as { full_name?: string | null; email?: string | null } | null)?.full_name
    ?? (inviter as { email?: string | null } | null)?.email?.split("@")[0]
    ?? "Stefan";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #18181b;">
      <h2 style="margin: 0 0 6px;">You're invited to TexasTurf OS</h2>
      <p style="color: #71717a; margin: 0 0 18px;">${inviterDisplay} added you to the team.</p>
      <p>Click the link below to sign in. It'll log you in automatically and walk you through a quick setup.</p>
      <p style="margin: 24px 0;">
        <a href="${args.inviteLink}"
           style="display: inline-block; background: #18181b; color: #fff;
                  padding: 12px 24px; border-radius: 8px; text-decoration: none;
                  font-weight: 600;">
          Open TexasTurf OS →
        </a>
      </p>
      <p style="color: #71717a; font-size: 12px;">
        If the button doesn't work, paste this link into your browser:<br>
        <span style="word-break: break-all;">${args.inviteLink}</span>
      </p>
      <p style="color: #a1a1aa; font-size: 11px; margin-top: 32px;">
        Didn't expect this email? You can safely ignore it.
      </p>
    </div>
  `;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: `${inviterDisplay} invited you to TexasTurf OS`,
        html,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { ok: false, detail: `Resend returned ${resp.status}: ${body.slice(0, 240)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
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
