"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type ActionState = { error: string | null; success: boolean; info?: string };

const TYPES = ["long_video", "short", "pov_clip", "before_after", "photo_set", "blog_post", "voice_memo", "other"] as const;
const STATUSES = ["idea", "scripted", "scheduled_shoot", "filmed", "editing", "ready", "published", "archived"] as const;
const ASSIGNEES = ["warehouse", "ivana", "stefan", "troy"] as const;

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(TYPES).default("other"),
  status: z.enum(STATUSES).default("idea"),
  service_line: z.string().optional(),
  hook: z.string().optional(),
  tag: z.string().optional(),
  assignee: z.enum(ASSIGNEES).optional(),
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
    tag: formData.get("tag") || undefined,
    assignee: formData.get("assignee") || undefined,
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
    tag: parsed.data.tag ?? null,
    assignee: parsed.data.assignee ?? null,
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

/** Drag-and-drop status move — plain callable, not form-bound (mirrors
 * tasks/actions.ts updateTaskStatus). Stamps published_on on arrival at 'published'. */
export async function moveContentItem(
  id: string,
  status: (typeof STATUSES)[number],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const patch: Database["public"]["Tables"]["content_items"]["Update"] = { status };
  if (status === "published") patch.published_on = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("content_items").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/marketing/content");
  revalidatePath("/marketing");
  return {};
}

export type ContentDetailPatch = {
  title?: string;
  tag?: string | null;
  assignee?: (typeof ASSIGNEES)[number] | null;
  type?: (typeof TYPES)[number];
  service_line?: string | null;
  hook?: string | null;
  script_md?: string | null;
  shot_list_md?: string | null;
  b_roll_md?: string | null;
  props_md?: string | null;
};

/** Save the full play-by-play from the detail panel — plain callable. */
export async function updateContentDetail(id: string, patch: ContentDetailPatch): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("content_items").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/marketing/content");
  return {};
}

/** Delete a content idea from the funnel — plain callable. */
export async function deleteContentItem(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("content_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/marketing/content");
  revalidatePath("/marketing");
  return {};
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

  const patch: Database["public"]["Tables"]["content_items"]["Update"] = { status: parsed.data.status };
  if (parsed.data.status === "published") {
    patch.published_on = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase.from("content_items").update(patch).eq("id", parsed.data.id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/content");
  revalidatePath("/marketing");
  return { error: null, success: true };
}

const categorySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(TYPES).optional(),
  service_line: z.string().optional(),
});

/** Quick re-categorize: set type and/or service line on an item in one tap. */
export async function updateContentCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = categorySchema.safeParse({
    id: formData.get("id"),
    type: formData.get("type") || undefined,
    service_line: formData.get("service_line") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const patch: Database["public"]["Tables"]["content_items"]["Update"] = {};
  if (parsed.data.type) patch.type = parsed.data.type;
  if (parsed.data.service_line !== undefined) patch.service_line = parsed.data.service_line || null;
  if (Object.keys(patch).length === 0) return { error: "Nothing to update.", success: false };

  const { error } = await supabase.from("content_items").update(patch).eq("id", parsed.data.id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/content");
  return { error: null, success: true };
}

// ── AI generators (Marketing OS) ─────────────────────────────────────────────
// Both return providerMissing so the UI can render the amber "AI provider
// missing" state instead of a generic error. Every generation is logged to
// marketing_ai_generations.

export type AiCardActionResult = {
  error?: string;
  providerMissing?: boolean;
  createdTitle?: string;
};

/** Rough idea → complete card, inserted straight into the Ideas column.
 * New record (nothing to overwrite), flagged is_ai_generated. */
export async function aiCreateContentCard(roughIdea: string): Promise<AiCardActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const idea = roughIdea.trim();
  if (idea.length < 3) return { error: "Give the AI at least a few words to work with." };
  if (idea.length > 2000) return { error: "Keep the rough idea under 2,000 characters." };

  const { generateContentCard, logAiGeneration } = await import("@/lib/ai/marketing");
  const result = await generateContentCard(idea);
  if (!result.ok) {
    if (result.error === "provider_missing") return { providerMissing: true, error: result.message };
    return { error: result.message };
  }

  const card = result.data;
  const { data: inserted, error } = await supabase
    .from("content_items")
    .insert({
      title: card.title,
      type: card.type,
      status: "idea",
      tag: card.tag,
      assignee: card.assignee,
      service_line: card.service_line,
      hook: card.hook,
      script_md: card.script_md,
      shot_list_md: card.shot_list_md,
      b_roll_md: card.b_roll_md,
      props_md: card.props_md,
      is_ai_generated: true,
      creator_id: user.id,
      created_by_id: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAiGeneration(supabase, {
    section: "content",
    generation_type: "content_card",
    input: { rough_idea: idea },
    output: card,
    linked_table: "content_items",
    linked_record_id: inserted.id,
    created_by: user.id,
  });

  revalidatePath("/marketing/content");
  revalidatePath("/marketing");
  return { createdTitle: card.title };
}

export type AiDetailsActionResult = {
  error?: string;
  providerMissing?: boolean;
  details?: {
    hook: string;
    script_md: string;
    shot_list_md: string;
    b_roll_md: string;
    props_md: string;
    tag: string;
    assignee: (typeof ASSIGNEES)[number];
  };
};

/** Fill the play-by-play for an existing card. Returns the generated fields
 * WITHOUT saving — the user reviews in the panel and confirms via Save, so
 * AI never overwrites existing work on its own. */
export async function aiGenerateContentDetails(id: string): Promise<AiDetailsActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: item, error: readError } = await supabase
    .from("content_items")
    .select("title, type, tag, assignee, service_line, hook")
    .eq("id", id)
    .single();
  if (readError || !item) return { error: readError?.message ?? "Card not found." };

  const { generateContentDetails, logAiGeneration } = await import("@/lib/ai/marketing");
  const result = await generateContentDetails(item);
  if (!result.ok) {
    if (result.error === "provider_missing") return { providerMissing: true, error: result.message };
    return { error: result.message };
  }

  await logAiGeneration(supabase, {
    section: "content",
    generation_type: "content_details",
    input: { content_item_id: id, card: item },
    output: result.data,
    linked_table: "content_items",
    linked_record_id: id,
    created_by: user.id,
  });

  return { details: result.data };
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
