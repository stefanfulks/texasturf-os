"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function addArea(sessionId: string, label: string): Promise<{ id: string } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("pitch_areas")
    .insert({ session_id: sessionId, label: label.trim() || "Area", product: "TexasPlay" })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add area" };
  revalidatePath(`/pitch/${sessionId}/document`);
  return { id: data.id };
}

export async function updateArea(
  areaId: string,
  patch: { label?: string; installed_sqft?: number; application?: string; tearout_tier?: string; access?: string; notes?: string },
): Promise<{ error: string | null }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("pitch_areas")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", areaId);
  return { error: error?.message ?? null };
}

export async function removeArea(sessionId: string, areaId: string): Promise<void> {
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("pitch_areas").delete().eq("id", areaId);
  revalidatePath(`/pitch/${sessionId}/document`);
}

export async function saveSiteDoc(
  sessionId: string,
  conditions: Record<string, string | number | boolean | null>,
  useNotes: Record<string, string | number | boolean | null>,
): Promise<{ error: string | null }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("pitch_site_docs")
    .upsert(
      { session_id: sessionId, conditions, use_notes: useNotes, updated_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: "session_id" },
    );
  return { error: error?.message ?? null };
}

export async function addPitchPhoto(
  sessionId: string,
  category: string,
  path: string,
  name: string,
  areaId?: string | null,
): Promise<{ id: string } | { error: string }> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("pitch_photos")
    .insert({ session_id: sessionId, area_id: areaId ?? null, category, path, name, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save photo" };
  return { id: data.id };
}

export async function removePitchPhoto(photoId: string, path: string): Promise<void> {
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.from("pitch_photos").delete().eq("id", photoId);
  await supabase.storage.from("pitch-photos").remove([path]);
}

/** Finish documentation: move the session to `documenting` (idempotent from draft). */
export async function markDocumented(sessionId: string): Promise<void> {
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase
    .from("pitch_sessions")
    .update({ status: "documenting", documented_at: new Date().toISOString() })
    .eq("id", sessionId);
  revalidatePath("/pitch");
  revalidatePath(`/pitch/${sessionId}/document`);
}
