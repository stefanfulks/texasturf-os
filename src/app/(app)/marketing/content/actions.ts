"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null; success: boolean; info?: string };

const TYPES = ["long_video", "short", "pov_clip", "before_after", "photo_set", "blog_post", "voice_memo", "other"] as const;
const STATUSES = ["idea", "scripted", "scheduled_shoot", "filmed", "editing", "ready", "published", "archived"] as const;

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(TYPES).default("other"),
  status: z.enum(STATUSES).default("idea"),
  service_line: z.string().optional(),
  hook: z.string().optional(),
  drive_url: z.string().url().optional().or(z.literal("")),
  youtube_url: z.string().url().optional().or(z.literal("")),
  asset_path: z.string().optional(),   // set by the client after a bucket upload (voice memos)
});

/** Create a content item. Voice memos arrive with type='voice_memo' + asset_path. */
export async function createContentItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type") || "other",
    status: formData.get("status") || "idea",
    service_line: formData.get("service_line") || undefined,
    hook: formData.get("hook") || undefined,
    drive_url: formData.get("drive_url") || undefined,
    youtube_url: formData.get("youtube_url") || undefined,
    asset_path: formData.get("asset_path") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase.from("content_items").insert({
    title: parsed.data.title,
    type: parsed.data.type,
    status: parsed.data.status,
    service_line: parsed.data.service_line ?? null,
    hook: parsed.data.hook ?? null,
    drive_url: parsed.data.drive_url || null,
    youtube_url: parsed.data.youtube_url || null,
    asset_path: parsed.data.asset_path || null,
    creator_id: user.id,
    created_by_id: user.id,
  });
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/content");
  revalidatePath("/marketing");
  return { error: null, success: true, info: "Added." };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
});

/** Move an item through the pipeline. Stamps published_on when it hits published. */
export async function updateContentStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const patch: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "published") {
    patch.published_on = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase.from("content_items").update(patch).eq("id", parsed.data.id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/content");
  revalidatePath("/marketing");
  return { error: null, success: true };
}

const linksSchema = z.object({
  id: z.string().uuid(),
  drive_url: z.string().url().optional().or(z.literal("")),
  youtube_url: z.string().url().optional().or(z.literal("")),
});

/** Attach Drive / YouTube links to an item from the library. */
export async function updateContentLinks(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = linksSchema.safeParse({
    id: formData.get("id"),
    drive_url: formData.get("drive_url") || undefined,
    youtube_url: formData.get("youtube_url") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase
    .from("content_items")
    .update({ drive_url: parsed.data.drive_url || null, youtube_url: parsed.data.youtube_url || null })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/content");
  return { error: null, success: true };
}
