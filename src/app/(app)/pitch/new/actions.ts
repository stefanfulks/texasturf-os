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
    status: "draft",
    created_by: user.id,
  }).select("id").single();

  if (error || !data) return { error: error?.message ?? "Could not create pitch" };
  redirect(`/present/${data.id}`);
}
