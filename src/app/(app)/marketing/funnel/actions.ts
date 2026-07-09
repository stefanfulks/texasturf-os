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
