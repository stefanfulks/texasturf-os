"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { defaultStoredSlides, type StoredSlide } from "@/lib/pitch/deck";

/** Idempotently ensure a single default deck exists (seeded from code). Returns its id. */
export async function ensureDefaultDeck(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("pitch_decks").select("id").eq("is_default", true).maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase.from("pitch_decks").insert({
    name: "Default deck",
    is_default: true,
    slides: defaultStoredSlides(),
    created_by: user.id,
  }).select("id").single();

  if (error || !data) {
    // Lost a race or unique-default conflict — re-fetch.
    const { data: again } = await supabase
      .from("pitch_decks").select("id").eq("is_default", true).maybeSingle();
    return again?.id ?? null;
  }
  return data.id;
}

export async function seedDefaultDeck(): Promise<void> {
  await ensureDefaultDeck();
  revalidatePath("/pitch/decks");
}

export async function createDeck(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const name = ((formData.get("name") as string) || "").trim() || "New deck";
  await supabase.from("pitch_decks").insert({
    name, slides: defaultStoredSlides(), created_by: user.id,
  });
  revalidatePath("/pitch/decks");
}

export async function updateDeck(deckId: string, name: string, slides: StoredSlide[]): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase.from("pitch_decks")
    .update({ name, slides, updated_at: new Date().toISOString() })
    .eq("id", deckId);
  if (error) return { error: error.message };
  revalidatePath(`/pitch/decks/${deckId}`);
  revalidatePath("/pitch/decks");
  return { error: null };
}
