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
