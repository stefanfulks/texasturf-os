"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = ["bug","feature_request","question","other"] as const;
const STATUSES   = ["new","in_progress","resolved","wont_fix"] as const;

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const STATUS_LABEL: Record<string, string> = {
  new:         "New",
  in_progress: "In progress",
  resolved:    "Resolved",
  wont_fix:    "Won't fix",
};

// Shared result shape for the lightweight feedback mutations.
export type FeedbackMutationState = { error: string | null; success: boolean };

const idSchema = z.object({ id: z.string().uuid() });

// ─── Submit ──────────────────────────────────────────────────────────────────

const attachmentSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().nonnegative(),
});

const submitSchema = z.object({
  category:    z.enum(CATEGORIES),
  subject:     z.string().min(3, "Subject is required"),
  body:        z.string().optional(),
  page_url:    z.string().optional(),
  attachments: z.array(attachmentSchema).max(4, "Up to 4 screenshots").optional(),
});

export type SubmitFeedbackState = { error: string | null; success: boolean };

function parseAttachments(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function submitFeedback(
  _prev: SubmitFeedbackState,
  formData: FormData,
): Promise<SubmitFeedbackState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = submitSchema.safeParse({
    category:    formData.get("category") || "other",
    subject:     formData.get("subject"),
    body:        formData.get("body")     || undefined,
    page_url:    formData.get("page_url") || undefined,
    attachments: parseAttachments(formData.get("attachments")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  // Defense in depth: every uploaded path must live under THIS user's folder.
  // Storage RLS already enforces this on upload, but never trust the client.
  const attachments = parsed.data.attachments ?? [];
  if (attachments.some((a) => !a.path.startsWith(`${user.id}/`))) {
    return { error: "Invalid attachment", success: false };
  }

  const { error } = await supabase.from("app_feedback").insert({
    user_id:     user.id,
    category:    parsed.data.category,
    subject:     parsed.data.subject,
    body:        parsed.data.body  ?? null,
    page_url:    parsed.data.page_url ?? null,
    attachments,
  } as never);

  if (error) return { error: error.message, success: false };

  revalidatePath("/feedback");
  return { error: null, success: true };
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Confirm the caller is an admin. Returns their id on success. */
async function requireAdmin(
  supabase: SupabaseServer,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, error: "Admin only" };
  }
  return { ok: true, userId: user.id };
}

/**
 * Apply a status change to a feedback row and, when it actually changes,
 * notify the original submitter (never the admin acting on their own item).
 * Pass `adminNotes` to also set the reply; omit it to leave notes untouched.
 */
async function applyFeedbackStatus(
  supabase: SupabaseServer,
  id: string,
  status: (typeof STATUSES)[number],
  adminId: string,
  adminNotes?: string | null,
): Promise<{ error: string | null }> {
  // Grab the submitter + prior status so we can close the loop with a
  // notification when the status actually changes.
  const { data: before } = await supabase
    .from("app_feedback")
    .select("user_id, subject, status")
    .eq("id", id)
    .single();
  const prior = before as unknown as {
    user_id: string | null;
    subject: string | null;
    status: string;
  } | null;

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (adminNotes !== undefined) patch.admin_notes = adminNotes ?? null;
  if (status === "resolved" || status === "wont_fix") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = adminId;
  } else {
    patch.resolved_at = null;
    patch.resolved_by = null;
  }

  const { error } = await supabase.from("app_feedback").update(patch as never).eq("id", id);
  if (error) return { error: error.message };

  // Notify the submitter that their feedback moved — only on a real status
  // change, and never notify the admin about their own action.
  if (prior?.user_id && prior.user_id !== adminId && prior.status !== status) {
    await supabase.from("notifications").insert({
      user_id:       prior.user_id,
      actor_id:      adminId,
      type:          "feedback_update",
      title:         "Your feedback was updated",
      body:          `${prior.subject ?? "Feedback"} → ${STATUS_LABEL[status] ?? status}`,
      resource_type: "feedback",
      resource_id:   id,
    } as never);
  }

  return { error: null };
}

// ─── Admin triage ────────────────────────────────────────────────────────────

const triageSchema = z.object({
  id:          z.string().uuid(),
  status:      z.enum(STATUSES),
  admin_notes: z.string().optional(),
});

export type TriageFeedbackState = { error: string | null; success: boolean };

export async function triageFeedback(
  _prev: TriageFeedbackState,
  formData: FormData,
): Promise<TriageFeedbackState> {
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if (!gate.ok) return { error: gate.error, success: false };

  const parsed = triageSchema.safeParse({
    id:          formData.get("id"),
    status:      formData.get("status"),
    admin_notes: formData.get("admin_notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };

  const { error } = await applyFeedbackStatus(
    supabase,
    parsed.data.id,
    parsed.data.status,
    gate.userId,
    parsed.data.admin_notes ?? null,
  );
  if (error) return { error, success: false };

  revalidatePath("/admin/feedback");
  revalidatePath("/feedback");
  return { error: null, success: true };
}

// ─── Admin quick actions: mark complete + delete ───────────────────────────────

export async function markFeedbackComplete(
  _prev: FeedbackMutationState,
  formData: FormData,
): Promise<FeedbackMutationState> {
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if (!gate.ok) return { error: gate.error, success: false };

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Bad request", success: false };

  const { error } = await applyFeedbackStatus(supabase, parsed.data.id, "resolved", gate.userId);
  if (error) return { error, success: false };

  revalidatePath("/admin/feedback");
  revalidatePath("/feedback");
  return { error: null, success: true };
}

export async function deleteFeedback(
  _prev: FeedbackMutationState,
  formData: FormData,
): Promise<FeedbackMutationState> {
  const supabase = await createClient();
  const gate = await requireAdmin(supabase);
  if (!gate.ok) return { error: gate.error, success: false };

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Bad request", success: false };

  // Soft delete — a daily cron purges the row + its screenshots 30 days later.
  const { error } = await supabase
    .from("app_feedback")
    .update({ deleted_at: new Date().toISOString(), deleted_by: gate.userId } as never)
    .eq("id", parsed.data.id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/admin/feedback");
  revalidatePath("/feedback");
  return { error: null, success: true };
}

// ─── Submitter: withdraw your own (untriaged) feedback ─────────────────────────

export async function withdrawFeedback(
  _prev: FeedbackMutationState,
  formData: FormData,
): Promise<FeedbackMutationState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Bad request", success: false };

  const { data: row } = await supabase
    .from("app_feedback")
    .select("user_id, status, deleted_at")
    .eq("id", parsed.data.id)
    .single();
  const r = row as unknown as { user_id: string; status: string; deleted_at: string | null } | null;

  if (!r || r.user_id !== user.id) return { error: "Not found", success: false };
  if (r.deleted_at) return { error: null, success: true }; // already withdrawn
  if (r.status !== "new") return { error: "Already being handled — can't withdraw.", success: false };

  const { error } = await supabase
    .from("app_feedback")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id } as never)
    .eq("id", parsed.data.id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/feedback");
  return { error: null, success: true };
}
