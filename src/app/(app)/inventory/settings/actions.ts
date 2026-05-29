"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SaveSettingsState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type SettingUpsert = { key: string; value: unknown };

export async function saveInventorySettings(
  _prev: SaveSettingsState,
  formData: FormData,
): Promise<SaveSettingsState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "office"].includes((profile as { role: string }).role)) {
    return { status: "error", message: "Only admin or office can change inventory settings." };
  }

  // ─── Default receiving location ───
  const rawLoc = (formData.get("default_receiving_location_id") as string | null)?.trim() ?? "";
  const locValue: string | null = rawLoc === "" ? null : rawLoc;

  // ─── Low-stock threshold factor ───
  const rawFactor = (formData.get("low_stock_threshold_factor") as string | null)?.trim() ?? "";
  const parsedFactor = parseFloat(rawFactor);
  if (rawFactor === "" || Number.isNaN(parsedFactor) || parsedFactor <= 0) {
    return { status: "error", message: "Low-stock threshold factor must be a positive number." };
  }

  // ─── Auto-archive days ───
  const rawDays = (formData.get("auto_archive_completed_jobs_after_days") as string | null)?.trim() ?? "";
  let daysValue: number | null = null;
  if (rawDays !== "") {
    const parsedDays = parseInt(rawDays, 10);
    if (Number.isNaN(parsedDays) || parsedDays < 0) {
      return { status: "error", message: "Auto-archive days must be a non-negative whole number, or blank for never." };
    }
    daysValue = parsedDays;
  }

  const upserts: SettingUpsert[] = [
    { key: "default_receiving_location_id", value: locValue },
    { key: "low_stock_threshold_factor", value: parsedFactor },
    { key: "auto_archive_completed_jobs_after_days", value: daysValue },
  ];

  // Update each row by key (rows seeded by the migration; we update, not insert)
  const updatePayload = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  for (const u of upserts) {
    const { error } = await supabase
      .from("inv_settings")
      // value is jsonb so it accepts any JSON; supabase-js types are strict so cast.
      .update({ ...updatePayload, value: u.value } as unknown as never)
      .eq("key", u.key);

    if (error) {
      return { status: "error", message: `Failed to save ${u.key}: ${error.message}` };
    }
  }

  revalidatePath("/inventory/settings");
  revalidatePath("/inventory/receive");
  return { status: "success", message: "Settings saved." };
}
