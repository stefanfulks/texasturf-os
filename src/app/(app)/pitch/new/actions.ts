"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveTiers } from "@/lib/pitch/queries";
import { priceTiers } from "@/lib/pitch/pricing";
import { ensureDefaultDeck } from "../decks/actions";
import type { BaseJob } from "@/lib/pitch/types";

export type NewPitchState = { error: string | null };

const schema = z.object({
  prospect_name: z.string().optional(),
  address: z.string().optional(),
  installedSqft: z.coerce.number().positive("Square footage is required"),
  application: z.enum(["soil", "concrete"]),
  tearoutTier: z.string().min(1),
  access: z.enum(["normal", "difficult"]),
  client_id: z.string().optional(),
});

export async function createPitchSession(_prev: NewPitchState, formData: FormData): Promise<NewPitchState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = schema.safeParse({
    prospect_name: formData.get("prospect_name") || undefined,
    address: formData.get("address") || undefined,
    installedSqft: formData.get("installedSqft"),
    application: formData.get("application"),
    tearoutTier: formData.get("tearoutTier"),
    access: formData.get("access"),
    client_id: formData.get("client_id") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues.map((e) => e.message).join(", ") };

  const base: BaseJob = {
    installedSqft: parsed.data.installedSqft,
    application: parsed.data.application,
    tearoutTier: parsed.data.tearoutTier,
    access: parsed.data.access,
  };
  const tiers = await getActiveTiers();
  const prices = priceTiers(base, tiers);
  const deckId = await ensureDefaultDeck();

  const { data, error } = await supabase.from("pitch_sessions").insert({
    prospect_name: parsed.data.prospect_name ?? null,
    address: parsed.data.address ?? null,
    base_job: base,
    tier_snapshot: tiers,
    quote_snapshot: prices,
    deck_id: deckId,
    client_id: parsed.data.client_id ?? null,
    status: "draft",
    created_by: user.id,
  }).select("id").single();

  if (error || !data) return { error: error?.message ?? "Could not create pitch" };
  redirect(`/pitch/${data.id}/document`);
}

/** Search synced Jobber clients to link a pitch (powers the new-pitch picker). */
export async function searchJobberClientsForPitch(q: string): Promise<{ id: string; label: string }[]> {
  const term = q.trim().replace(/[%,()]/g, "");
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobber_clients")
    .select("id, first_name, last_name, company_name")
    .or(`company_name.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
    .eq("is_archived", false)
    .limit(8);
  return (data ?? []).map((c) => ({
    id: c.id,
    label: c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed client",
  }));
}
