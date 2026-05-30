"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  status: z.enum([
    "available",
    "assigned_to_job",
    "in_use_today",
    "maintenance_needed",
    "out_of_service",
  ]),
  ready_status: z.enum(["ready", "needs_prep", "not_ready"]),
  load_status: z.enum(["empty", "partially_loaded", "fully_loaded", "trash"]),
  next_action: z.string().optional(),
  notes: z.string().optional(),
});

export type UpdateAssetState = {
  error: string | null;
  success: boolean;
};

export async function updateAsset(
  _prevState: UpdateAssetState,
  formData: FormData,
): Promise<UpdateAssetState> {
  const raw = {
    id: formData.get("id"),
    name: formData.get("name"),
    status: formData.get("status"),
    ready_status: formData.get("ready_status"),
    load_status: formData.get("load_status"),
    next_action: formData.get("next_action") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  };

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((e) => e.message).join(", "),
      success: false,
    };
  }

  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false };

  const { id, ...fields } = parsed.data;

  const { error } = await supabase
    .from("assets")
    .update({
      ...fields,
      next_action: fields.next_action || null,
      notes: fields.notes || null,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message, success: false };
  }

  revalidatePath("/fleet");
  revalidatePath(`/fleet/${id}`, "page");

  return { error: null, success: true };
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireOfficeOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated" as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin","office"].includes(profile.role)) {
    return { user, error: "Only admin and office can modify fleet" as const };
  }
  return { user, error: null as null | string };
}

// ─── Archive / Unarchive ──────────────────────────────────────────────────────

export type ArchiveAssetState = { error: string | null; success: boolean };

async function setAssetArchived(assetId: string, archived: boolean): Promise<ArchiveAssetState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false };
  if (!assetId) return { error: "Asset ID required", success: false };

  // The archived column is added by migration 20260530300000_fleet_archive.sql.
  // Cast through unknown until generated types regenerate.
  const { error } = await supabase.from("assets")
    .update({ archived, updated_at: new Date().toISOString() } as never)
    .eq("id", assetId);
  if (error) return { error: error.message, success: false };

  revalidatePath("/fleet");
  revalidatePath(`/fleet/${assetId}`, "page");
  return { error: null, success: true };
}

export async function archiveAsset(_prev: ArchiveAssetState, formData: FormData): Promise<ArchiveAssetState> {
  return setAssetArchived(formData.get("asset_id") as string, true);
}

export async function unarchiveAsset(_prev: ArchiveAssetState, formData: FormData): Promise<ArchiveAssetState> {
  return setAssetArchived(formData.get("asset_id") as string, false);
}
