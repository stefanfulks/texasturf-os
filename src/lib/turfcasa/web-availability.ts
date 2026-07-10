"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * TurfCasa web-availability admin actions.
 *
 * The office edits per-product availability tiers + visibility here; the
 * storefront reads the derived v_turfcasa_web_products view. On every save we
 * ping the storefront's on-demand revalidation hook so shoppers see the change
 * within seconds instead of waiting for its ISR window.
 *
 * Uses the untyped service-role client so it builds before the migration's
 * tables land in database.types.ts. After `pnpm typegen`, these can move to the
 * typed server client.
 */

export type WebAvailabilityTier =
  | "same_day"
  | "lead_1_2_days"
  | "lead_weeks"
  | "lead_months"
  | "unavailable";

const TIERS: WebAvailabilityTier[] = [
  "same_day",
  "lead_1_2_days",
  "lead_weeks",
  "lead_months",
  "unavailable",
];

async function pingStorefront(slug: string): Promise<void> {
  const url = process.env.TURFCASA_SITE_REVALIDATE_URL;
  const secret = process.env.TURFCASA_SITE_REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ slugs: [slug] }),
    });
  } catch {
    // Best-effort — the storefront also refreshes on its own ISR cadence.
  }
}

export async function updateWebAvailability(formData: FormData): Promise<void> {
  const webSlug = String(formData.get("web_slug") ?? "");
  const availability = String(formData.get("availability") ?? "");
  const leadRaw = String(formData.get("lead_time_days") ?? "").trim();
  const webVisible = formData.get("web_visible") === "on";
  if (!webSlug || !TIERS.includes(availability as WebAvailabilityTier)) return;

  const db = supabaseAdmin();
  await db
    .from("turfcasa_web_availability")
    .update({
      availability,
      lead_time_days: leadRaw === "" ? null : Number(leadRaw),
      web_visible: webVisible,
      updated_at: new Date().toISOString(),
    })
    .eq("web_slug", webSlug);

  revalidatePath("/turfcasa/catalog");
  await pingStorefront(webSlug);
}
