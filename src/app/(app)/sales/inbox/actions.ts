"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { salesDb } from "@/lib/sales/db";

export type ResolveResult = { ok: true } | { ok: false; reason: string };

export async function resolveUnmatched(
  id: string,
  note: string | null,
): Promise<ResolveResult> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: "Not signed in." };

  const trimmed = note?.trim();
  const { error } = await (sb.from("unmatched_calls") as unknown as {
    update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  })
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_note: trimmed && trimmed.length > 0 ? trimmed : null,
    })
    .eq("id", id);

  if (error) return { ok: false, reason: error.message };
  revalidatePath("/sales/inbox");
  return { ok: true };
}

export interface ConvertInput {
  name: string;
  phone: string;
  company?: string | null;
}

export type ConvertResult =
  | { ok: true; dealId: string }
  | { ok: false; reason: string };

/**
 * Convert an unmatched voicemail to a real sales contact + lead-stage deal,
 * and mark the unmatched row resolved.
 */
export async function convertUnmatchedToDeal(
  id: string,
  input: ConvertInput,
): Promise<ConvertResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not signed in." };

  if (!input.name.trim() || !input.phone.trim()) {
    return { ok: false, reason: "Name and phone are required." };
  }

  const sb = await salesDb();

  const { data: contactRow } = await sb
    .from("sales_contacts")
    .insert({
      name: input.name.trim(),
      phone: input.phone.trim(),
      company: input.company?.trim() || null,
      source: "voicemail",
    })
    .select("id")
    .single();
  const contactId = (contactRow as { id: string } | null)?.id;
  if (!contactId) return { ok: false, reason: "Couldn't create contact." };

  const { data: dealRow } = await sb
    .from("deals")
    .insert({
      name: `${input.name.trim()} — first project`,
      stage: "lead",
      sales_contact_id: contactId,
      owner_id: user.id,
      notes: "Created from voicemail triage.",
    })
    .select("id")
    .single();
  const dealId = (dealRow as { id: string } | null)?.id;
  if (!dealId) return { ok: false, reason: "Couldn't create deal." };

  const { error: resolveErr } = await (supabase.from("unmatched_calls") as unknown as {
    update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  })
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_note: `Converted to deal ${dealId}`,
    })
    .eq("id", id);
  if (resolveErr) return { ok: false, reason: resolveErr.message };

  revalidatePath("/sales/inbox");
  revalidatePath("/sales");
  return { ok: true, dealId };
}
