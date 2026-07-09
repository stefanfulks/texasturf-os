"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type ActionState = { error: string | null; success: boolean; info?: string };

const TYPES = ["referral", "service_spotlight", "seasonal", "event", "other"] as const;
const STATUSES = ["draft", "active", "paused", "completed"] as const;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "campaign";
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(TYPES).default("other"),
  service_line: z.string().optional(),
  starts_on: z.string().optional(),
  brief_md: z.string().optional(),
  objective: z.string().optional(),
  audience: z.string().optional(),
  offer: z.string().optional(),
  next_action: z.string().optional(),
  notes: z.string().optional(),
});

/** Create a campaign (draft). Slug derived from the name + a short suffix for uniqueness. */
export async function createCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "other",
    service_line: formData.get("service_line") || undefined,
    starts_on: formData.get("starts_on") || undefined,
    brief_md: formData.get("brief_md") || undefined,
    objective: formData.get("objective") || undefined,
    audience: formData.get("audience") || undefined,
    offer: formData.get("offer") || undefined,
    next_action: formData.get("next_action") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  // Unique-ish slug: base + 4-char suffix from the name length + char codes (no RNG in server action path).
  const base = slugify(parsed.data.name);
  const suffix = (base.length * 7 + parsed.data.name.charCodeAt(0)).toString(36).slice(0, 4);
  const slug = `${base}-${suffix}`;

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      slug,
      name: parsed.data.name,
      type: parsed.data.type,
      status: "draft",
      service_line: parsed.data.service_line ?? null,
      starts_on: parsed.data.starts_on || null,
      brief_md: parsed.data.brief_md ?? null,
      objective: parsed.data.objective ?? null,
      audience: parsed.data.audience ?? null,
      offer: parsed.data.offer ?? null,
      next_action: parsed.data.next_action ?? null,
      notes: parsed.data.notes ?? null,
      owner_id: user.id,
      created_by_id: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create campaign", success: false };

  revalidatePath("/marketing/campaigns");
  revalidatePath("/marketing");
  redirect(`/marketing/campaigns/${data.id}`);
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
});

/** Change a campaign's status (draft → active → paused → completed). */
export async function updateCampaignStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
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

  const { error } = await supabase.from("campaigns").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/campaigns");
  revalidatePath(`/marketing/campaigns/${parsed.data.id}`);
  revalidatePath("/marketing");
  return { error: null, success: true };
}

// ── AI + brief editing + content linking (Marketing OS) ──────────────────────

export type AiBriefResult = {
  error?: string;
  providerMissing?: boolean;
  brief?: {
    name: string;
    objective: string;
    audience: string;
    offer: string;
    next_action: string;
    notes: string;
  };
};

/** Rough goal → campaign brief for form prefill. Nothing is saved — the user
 * reviews the filled form and confirms via Create/Save. */
export async function aiDraftCampaignBrief(
  roughGoal: string,
  linkedCampaignId?: string,
): Promise<AiBriefResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const goal = roughGoal.trim();
  if (goal.length < 3) return { error: "Give the AI at least a few words to work with." };
  if (goal.length > 2000) return { error: "Keep the goal under 2,000 characters." };

  const { generateCampaignBrief, logAiGeneration } = await import("@/lib/ai/marketing");
  const result = await generateCampaignBrief(goal);
  if (!result.ok) {
    if (result.error === "provider_missing") return { providerMissing: true, error: result.message };
    return { error: result.message };
  }

  await logAiGeneration(supabase, {
    section: "campaigns",
    generation_type: "campaign_brief",
    input: { rough_goal: goal },
    output: result.data,
    linked_table: linkedCampaignId ? "campaigns" : undefined,
    linked_record_id: linkedCampaignId,
    created_by: user.id,
  });

  return { brief: result.data };
}

export type CampaignBriefPatch = {
  objective?: string | null;
  audience?: string | null;
  offer?: string | null;
  next_action?: string | null;
  notes?: string | null;
  brief_md?: string | null;
};

/** Save the structured brief fields from the detail page — plain callable. */
export async function updateCampaignBrief(id: string, patch: CampaignBriefPatch): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("campaigns").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/marketing/campaigns/${id}`);
  revalidatePath("/marketing/campaigns");
  revalidatePath("/marketing");
  return {};
}

/** Link or unlink a content card to a campaign — plain callable. */
export async function setContentCampaign(
  contentId: string,
  campaignId: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("content_items")
    .update({ campaign_id: campaignId })
    .eq("id", contentId);
  if (error) return { error: error.message };

  if (campaignId) revalidatePath(`/marketing/campaigns/${campaignId}`);
  revalidatePath("/marketing/campaigns");
  revalidatePath("/marketing/content");
  return {};
}

const channelSchema = z.object({
  id: z.string().uuid(),
  channel: z.string().min(1),
});

/** Toggle a channel-checklist entry done/undone for a campaign. */
export async function toggleChannel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = channelSchema.safeParse({
    id: formData.get("id"),
    channel: formData.get("channel"),
  });
  if (!parsed.success) return { error: "Bad input", success: false };

  const { data: row, error: readErr } = await supabase
    .from("campaigns").select("channels").eq("id", parsed.data.id).single();
  if (readErr || !row) return { error: readErr?.message ?? "Campaign not found", success: false };

  type Channel = { channel: string; done_at: string | null };
  const channels: Channel[] = Array.isArray(row.channels) ? (row.channels as unknown as Channel[]) : [];
  const idx = channels.findIndex((c) => c.channel === parsed.data.channel);
  const nowStamp = new Date().toISOString();
  if (idx >= 0) {
    channels[idx] = { ...channels[idx], done_at: channels[idx].done_at ? null : nowStamp };
  } else {
    channels.push({ channel: parsed.data.channel, done_at: nowStamp });
  }

  const update: Database["public"]["Tables"]["campaigns"]["Update"] = {
    channels: channels as unknown as Database["public"]["Tables"]["campaigns"]["Update"]["channels"],
  };
  const { error } = await supabase.from("campaigns").update(update).eq("id", parsed.data.id);
  if (error) return { error: error.message, success: false };

  revalidatePath(`/marketing/campaigns/${parsed.data.id}`);
  return { error: null, success: true };
}
