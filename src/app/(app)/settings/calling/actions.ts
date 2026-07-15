"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RECORD_ANNOUNCEMENT_KEY } from "@/lib/calls/settings";

/** Toggle the recording announcement. User-context client — the admin-only
 * RLS policy on call_settings is the real gate. */
export async function setRecordAnnouncement(formData: FormData): Promise<void> {
  const enabled = formData.get("enabled") === "true";
  const sb = await createClient();
  await sb
    .from("call_settings")
    .update({ value: enabled, updated_at: new Date().toISOString() })
    .eq("key", RECORD_ANNOUNCEMENT_KEY);
  revalidatePath("/settings/calling");
}
