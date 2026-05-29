"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const locationSchema = z.object({
  name:        z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export type LocationFormState = { error: string | null; success: boolean };

export async function createLocation(
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = locationSchema.safeParse({
    name:        formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase.from("inv_locations").insert({
    name:        parsed.data.name,
    description: parsed.data.description ?? null,
  });

  if (error) return { error: error.message, success: false };

  revalidatePath("/inventory/locations");
  return { error: null, success: true };
}

export async function updateLocation(
  _prev: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const id = formData.get("id") as string;
  if (!id) return { error: "Location ID required", success: false };

  const parsed = locationSchema.safeParse({
    name:        formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase.from("inv_locations").update({
    name:        parsed.data.name,
    description: parsed.data.description ?? null,
  }).eq("id", id);

  if (error) return { error: error.message, success: false };

  revalidatePath("/inventory/locations");
  return { error: null, success: true };
}

export async function toggleLocationActive(id: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("inv_locations").update({ active }).eq("id", id);
  revalidatePath("/inventory/locations");
}
