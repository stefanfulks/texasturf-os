"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { CONTENT_BY_KEY } from "@/lib/content/registry";

/** Save (upsert) an override for a content block. Unknown keys are rejected so
 * the table can only ever hold registry-declared blocks. */
export async function saveContentBlock(key: string, value: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!CONTENT_BY_KEY.has(key)) return { ok: false, error: "Unknown content key" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("content_blocks")
    .upsert({ key, value, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/content");
  return { ok: true };
}

/** Reset to the in-code default by deleting the override row. */
export async function resetContentBlock(key: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("content_blocks").delete().eq("key", key);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/content");
  return { ok: true };
}
