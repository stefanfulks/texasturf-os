"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireOfficeOrAdmin } from "@/lib/auth/require-role";
import type { Json } from "@/lib/database.types";
import {
  SECTION_SCHEMAS,
  isSectionId,
  rollupPassFail,
  entryDateSchema,
  type SectionId,
} from "./schemas";

export type ActionState = { error: string | null; success: boolean };
const initial: ActionState = { error: null, success: false };

function formObject(formData: FormData): Record<string, FormDataEntryValue | null> {
  const obj: Record<string, FormDataEntryValue | null> = {};
  for (const [k, v] of formData.entries()) obj[k] = v;
  return obj;
}

export async function createEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { userId } = await requireOfficeOrAdmin();

    const sectionRaw = String(formData.get("section_id") ?? "");
    if (!isSectionId(sectionRaw)) return { error: "Unknown section", success: false };
    const section: SectionId = sectionRaw;

    const entryDate = entryDateSchema.safeParse(formData.get("entry_date"));
    if (!entryDate.success) return { error: entryDate.error.issues[0].message, success: false };

    const obj = formObject(formData);
    const payloadInput: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("p_")) payloadInput[k.slice(2)] = v ?? "";
    }
    const payloadParsed = SECTION_SCHEMAS[section].safeParse(payloadInput);
    if (!payloadParsed.success) {
      return { error: payloadParsed.error.issues.map((i) => i.message).join(", "), success: false };
    }
    const payload = payloadParsed.data as Record<string, unknown>;
    const pass_fail = rollupPassFail(section, payload as never);
    const payloadJson = payload as unknown as Json;

    const supabase = await createClient();
    const { error } = await supabase.from("kpi_log_entries").insert({
      section_id: section,
      entry_date: entryDate.data,
      payload:    payloadJson,
      pass_fail,
      notes:      (formData.get("notes") as string) || null,
      created_by: userId,
    });
    if (error) return { error: error.message, success: false };

    revalidatePath("/operations/kpi-log");
    return initial && { error: null, success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create entry", success: false };
  }
}

export async function updateEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireOfficeOrAdmin();

    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "Entry id required", success: false };

    const sectionRaw = String(formData.get("section_id") ?? "");
    if (!isSectionId(sectionRaw)) return { error: "Unknown section", success: false };
    const section: SectionId = sectionRaw;

    const entryDate = entryDateSchema.safeParse(formData.get("entry_date"));
    if (!entryDate.success) return { error: entryDate.error.issues[0].message, success: false };

    const obj = formObject(formData);
    const payloadInput: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("p_")) payloadInput[k.slice(2)] = v ?? "";
    }
    const payloadParsed = SECTION_SCHEMAS[section].safeParse(payloadInput);
    if (!payloadParsed.success) {
      return { error: payloadParsed.error.issues.map((i) => i.message).join(", "), success: false };
    }
    const payload = payloadParsed.data as Record<string, unknown>;
    const pass_fail = rollupPassFail(section, payload as never);
    const payloadJson = payload as unknown as Json;

    const supabase = await createClient();
    const { error } = await supabase
      .from("kpi_log_entries")
      .update({
        entry_date: entryDate.data,
        payload:    payloadJson,
        pass_fail,
        notes: (formData.get("notes") as string) || null,
      })
      .eq("id", id);
    if (error) return { error: error.message, success: false };

    revalidatePath("/operations/kpi-log");
    return { error: null, success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update entry", success: false };
  }
}

export async function signOff(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { userId } = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "Entry id required", success: false };

    const supabase = await createClient();
    const { error } = await supabase
      .from("kpi_log_entries")
      .update({
        mgmt_notes:     (formData.get("mgmt_notes") as string) || null,
        mgmt_signed_by: userId,
        mgmt_signed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { error: error.message, success: false };

    revalidatePath("/operations/kpi-log");
    return { error: null, success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to sign off", success: false };
  }
}

export async function clearSignOff(id: string): Promise<{ error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("kpi_log_entries")
      .update({ mgmt_notes: null, mgmt_signed_by: null, mgmt_signed_at: null })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/operations/kpi-log");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to clear sign-off" };
  }
}

export async function deleteEntry(id: string): Promise<{ error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("kpi_log_entries").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/operations/kpi-log");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete entry" };
  }
}
