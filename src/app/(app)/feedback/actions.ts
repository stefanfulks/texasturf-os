"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = ["bug","feature_request","question","other"] as const;
const STATUSES   = ["new","in_progress","resolved","wont_fix"] as const;

const submitSchema = z.object({
  category: z.enum(CATEGORIES),
  subject:  z.string().min(3, "Subject is required"),
  body:     z.string().optional(),
  page_url: z.string().optional(),
});

export type SubmitFeedbackState = { error: string | null; success: boolean };

export async function submitFeedback(
  _prev: SubmitFeedbackState,
  formData: FormData,
): Promise<SubmitFeedbackState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = submitSchema.safeParse({
    category: formData.get("category") || "other",
    subject:  formData.get("subject"),
    body:     formData.get("body")     || undefined,
    page_url: formData.get("page_url") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase.from("app_feedback").insert({
    user_id:  user.id,
    category: parsed.data.category,
    subject:  parsed.data.subject,
    body:     parsed.data.body  ?? null,
    page_url: parsed.data.page_url ?? null,
  } as never);

  if (error) return { error: error.message, success: false };

  revalidatePath("/feedback");
  return { error: null, success: true };
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Admin only", success: false };

  const parsed = triageSchema.safeParse({
    id:          formData.get("id"),
    status:      formData.get("status"),
    admin_notes: formData.get("admin_notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };

  const patch: Record<string, unknown> = {
    status:      parsed.data.status,
    admin_notes: parsed.data.admin_notes ?? null,
    updated_at:  new Date().toISOString(),
  };
  if (parsed.data.status === "resolved" || parsed.data.status === "wont_fix") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = user.id;
  } else {
    patch.resolved_at = null;
    patch.resolved_by = null;
  }

  const { error } = await supabase.from("app_feedback").update(patch as never).eq("id", parsed.data.id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/admin/feedback");
  revalidatePath("/feedback");
  return { error: null, success: true };
}
