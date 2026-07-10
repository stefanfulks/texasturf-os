"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Bulk-save the owner's real numbers. RLS restricts writes to admins —
 * a non-admin write surfaces as a policy error, which we relay. */
export async function saveBusinessInputs(
  entries: Array<{ input_key: string; value: string | null }>,
): Promise<{ error?: string; saved?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (entries.length === 0) return { saved: 0 };
  if (entries.length > 50) return { error: "Too many inputs in one save." };

  for (const e of entries) {
    const { error } = await supabase
      .from("marketing_business_inputs")
      .update({ value: e.value?.trim() || null, updated_by: user.id })
      .eq("input_key", e.input_key);
    if (error) {
      const friendly = error.message.includes("policy")
        ? "Only admins can edit business inputs."
        : error.message;
      return { error: friendly };
    }
  }

  revalidatePath("/marketing/funnel");
  revalidatePath("/marketing");
  return { saved: entries.length };
}

export type AdScriptsResult = {
  error?: string;
  providerMissing?: boolean;
  variants?: Array<{ angle: string; headline: string; primary_text: string; cta: string }>;
  missingCount?: number;
};

/** Generate 3 cold-lead ad variants for a service line, grounded in the
 * owner's real numbers. Missing numbers become bracket placeholders. */
export async function aiGenerateAdScripts(serviceLine: string): Promise<AdScriptsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const line = serviceLine.trim().slice(0, 60);
  if (!line) return { error: "Pick a service line first." };

  const { data: inputs, error: readError } = await supabase
    .from("marketing_business_inputs")
    .select("input_key, label, value")
    .eq("section", "ads")
    .order("sort_order");
  if (readError) return { error: readError.message };

  const known = (inputs ?? [])
    .filter((i) => i.value && i.value.trim())
    .map((i) => ({ label: i.label, value: i.value as string }));
  const missing = (inputs ?? []).filter((i) => !i.value?.trim()).map((i) => i.label);

  const { generateAdScripts, logAiGeneration } = await import("@/lib/ai/marketing");
  const result = await generateAdScripts(line, known, missing);
  if (!result.ok) {
    if (result.error === "provider_missing") return { providerMissing: true, error: result.message };
    return { error: result.message };
  }

  await logAiGeneration(supabase, {
    section: "ads",
    generation_type: "ad_scripts",
    input: { service_line: line, known_inputs: known.map((k) => k.label), missing_inputs: missing },
    output: result.data,
    created_by: user.id,
  });

  return { variants: result.data.variants, missingCount: missing.length };
}

// ── Ad Lab: swipe file actions ────────────────────────────────────────────────

import type { Json } from "@/lib/database.types";
import type { AiAdStructure, AiCrossBrandVariants } from "@/lib/ai/marketing";

export type SwipeStatus = "inbox" | "transcribed" | "analyzed" | "drafted";

/** Save an ad worth copying: title + link (any platform) + optional pasted
 * ad copy/transcript. The video itself gets uploaded from the detail panel. */
export async function createAdSwipe(input: {
  title: string;
  source_url?: string;
  platform?: string;
  transcript?: string;
  notes?: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = input.title.trim().slice(0, 200);
  if (!title) return { error: "Give the ad a name." };
  const transcript = input.transcript?.trim() || null;

  const { error } = await supabase.from("marketing_ad_swipes").insert({
    title,
    source_url: input.source_url?.trim() || null,
    platform: input.platform?.trim() || null,
    transcript,
    notes: input.notes?.trim() || null,
    status: transcript ? "transcribed" : "inbox",
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/marketing/funnel");
  return {};
}

/** Drag-and-drop column move — plain callable, optimistic on the client. */
export async function moveAdSwipe(id: string, status: SwipeStatus): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("marketing_ad_swipes").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/marketing/funnel");
  return {};
}

export type SwipePatch = {
  title?: string;
  source_url?: string | null;
  platform?: string | null;
  transcript?: string | null;
  notes?: string | null;
  asset_path?: string | null;
};

/** Detail-panel save — plain callable. */
export async function updateAdSwipe(id: string, patch: SwipePatch): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("marketing_ad_swipes").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/marketing/funnel");
  return {};
}

export async function deleteAdSwipe(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("marketing_ad_swipes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/marketing/funnel");
  return {};
}

/** Transcribe the uploaded copy of the ad (Whisper). Requires asset_path. */
export async function transcribeAdSwipe(id: string): Promise<{
  error?: string;
  providerMissing?: boolean;
  transcript?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: swipe, error: readError } = await supabase
    .from("marketing_ad_swipes")
    .select("id, title, asset_path, status")
    .eq("id", id)
    .single();
  if (readError || !swipe) return { error: readError?.message ?? "Swipe not found." };
  if (!swipe.asset_path) return { error: "Upload the video (or audio) first — links can't be downloaded from Facebook/YouTube directly." };

  const { data: blob, error: dlError } = await supabase.storage
    .from("marketing")
    .download(swipe.asset_path);
  if (dlError || !blob) return { error: dlError?.message ?? "Couldn't read the uploaded file." };

  const { transcribeMedia } = await import("@/lib/ai/transcribe");
  const filename = swipe.asset_path.split("/").pop() ?? "ad-video.mp4";
  const result = await transcribeMedia(blob, filename);
  if (!result.ok) {
    if (result.error === "provider_missing") return { providerMissing: true, error: result.message };
    return { error: result.message };
  }

  const { error: saveError } = await supabase
    .from("marketing_ad_swipes")
    .update({ transcript: result.text, status: swipe.status === "inbox" ? "transcribed" : swipe.status })
    .eq("id", id);
  if (saveError) return { error: saveError.message };

  const { logAiGeneration } = await import("@/lib/ai/marketing");
  await logAiGeneration(supabase, {
    section: "ads",
    generation_type: "ad_transcription",
    input: { swipe_id: id, asset_path: swipe.asset_path },
    output: { text: result.text },
    linked_table: "marketing_ad_swipes",
    linked_record_id: id,
    created_by: user.id,
  });

  revalidatePath("/marketing/funnel");
  return { transcript: result.text };
}

/** Break down the saved ad's replicable structure (needs a transcript). */
export async function analyzeAdSwipe(id: string): Promise<{
  error?: string;
  providerMissing?: boolean;
  structure?: AiAdStructure;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: swipe, error: readError } = await supabase
    .from("marketing_ad_swipes")
    .select("id, title, platform, transcript, notes")
    .eq("id", id)
    .single();
  if (readError || !swipe) return { error: readError?.message ?? "Swipe not found." };
  if (!swipe.transcript?.trim()) return { error: "Transcribe the video (or paste the ad copy) first." };

  const { analyzeAdStructure, logAiGeneration } = await import("@/lib/ai/marketing");
  const result = await analyzeAdStructure(swipe.transcript, {
    title: swipe.title,
    platform: swipe.platform,
    notes: swipe.notes,
  });
  if (!result.ok) {
    if (result.error === "provider_missing") return { providerMissing: true, error: result.message };
    return { error: result.message };
  }

  const { error: saveError } = await supabase
    .from("marketing_ad_swipes")
    .update({ structure: result.data as unknown as Json, status: "analyzed" })
    .eq("id", id);
  if (saveError) return { error: saveError.message };

  await logAiGeneration(supabase, {
    section: "ads",
    generation_type: "ad_analysis",
    input: { swipe_id: id, title: swipe.title },
    output: result.data,
    linked_table: "marketing_ad_swipes",
    linked_record_id: id,
    created_by: user.id,
  });

  revalidatePath("/marketing/funnel");
  return { structure: result.data };
}

/** Replicate the ad's structure for BOTH brands (2 variants each). */
export async function generateSwipeVariants(id: string): Promise<{
  error?: string;
  providerMissing?: boolean;
  variants?: AiCrossBrandVariants;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: swipe, error: readError } = await supabase
    .from("marketing_ad_swipes")
    .select("id, title, structure")
    .eq("id", id)
    .single();
  if (readError || !swipe) return { error: readError?.message ?? "Swipe not found." };
  if (!swipe.structure) return { error: "Run the structure breakdown first." };

  const { generateCrossBrandVariants, logAiGeneration } = await import("@/lib/ai/marketing");
  const result = await generateCrossBrandVariants(
    swipe.structure as unknown as AiAdStructure,
    swipe.title,
  );
  if (!result.ok) {
    if (result.error === "provider_missing") return { providerMissing: true, error: result.message };
    return { error: result.message };
  }

  const { error: saveError } = await supabase
    .from("marketing_ad_swipes")
    .update({ variants: result.data as unknown as Json, status: "drafted" })
    .eq("id", id);
  if (saveError) return { error: saveError.message };

  await logAiGeneration(supabase, {
    section: "ads",
    generation_type: "ad_cross_brand_variants",
    input: { swipe_id: id, title: swipe.title },
    output: result.data,
    linked_table: "marketing_ad_swipes",
    linked_record_id: id,
    created_by: user.id,
  });

  revalidatePath("/marketing/funnel");
  return { variants: result.data };
}

/** Bulk move selected swipes to a column — plain callable. */
export async function bulkMoveAdSwipes(ids: string[], status: SwipeStatus): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (ids.length === 0) return {};

  const { error } = await supabase.from("marketing_ad_swipes").update({ status }).in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/marketing/funnel");
  return {};
}

/** Bulk delete selected swipes — plain callable. */
export async function bulkDeleteAdSwipes(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (ids.length === 0) return {};

  const { error } = await supabase.from("marketing_ad_swipes").delete().in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/marketing/funnel");
  return {};
}
