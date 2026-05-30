"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOfficeOrAdmin } from "../_lib/require-role";

const itemSchema = z.object({
  name:         z.string().min(1, "Name is required"),
  sku:          z.string().optional(),
  quantity:     z.coerce.number().min(0).default(0),
  unit:         z.string().min(1, "Unit is required"),
  min_quantity: z.coerce.number().min(0).default(0),
  location_id:  z.string().uuid().optional(),
  notes:        z.string().optional(),
});

export type ItemFormState = { error: string | null; success: boolean };

function parseLocation(val: FormDataEntryValue | null): string | undefined {
  if (!val || val === "") return undefined;
  return String(val);
}

export async function createItem(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false };

  const parsed = itemSchema.safeParse({
    name:         formData.get("name"),
    sku:          formData.get("sku") || undefined,
    quantity:     formData.get("quantity") ?? 0,
    unit:         formData.get("unit"),
    min_quantity: formData.get("min_quantity") ?? 0,
    location_id:  parseLocation(formData.get("location_id")),
    notes:        formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase.from("inv_items").insert({
    name:         parsed.data.name,
    sku:          parsed.data.sku ?? null,
    quantity:     parsed.data.quantity,
    unit:         parsed.data.unit,
    min_quantity: parsed.data.min_quantity,
    location_id:  parsed.data.location_id ?? null,
    notes:        parsed.data.notes ?? null,
  });

  if (error) return { error: error.message, success: false };

  revalidatePath("/inventory/items");
  return { error: null, success: true };
}

export async function updateItem(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false };

  const id = formData.get("id") as string;
  if (!id) return { error: "Item ID required", success: false };

  const parsed = itemSchema.safeParse({
    name:         formData.get("name"),
    sku:          formData.get("sku") || undefined,
    quantity:     formData.get("quantity") ?? 0,
    unit:         formData.get("unit"),
    min_quantity: formData.get("min_quantity") ?? 0,
    location_id:  parseLocation(formData.get("location_id")),
    notes:        formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase.from("inv_items").update({
    name:         parsed.data.name,
    sku:          parsed.data.sku ?? null,
    quantity:     parsed.data.quantity,
    unit:         parsed.data.unit,
    min_quantity: parsed.data.min_quantity,
    location_id:  parsed.data.location_id ?? null,
    notes:        parsed.data.notes ?? null,
    updated_at:   new Date().toISOString(),
  }).eq("id", id);

  if (error) return { error: error.message, success: false };

  revalidatePath("/inventory/items");
  return { error: null, success: true };
}

export async function adjustItemQuantity(
  id: string,
  delta: number,
  reason?: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return { error: auth.error };

  const { data: item, error: fetchErr } = await supabase
    .from("inv_items")
    .select("quantity, notes")
    .eq("id", id)
    .single();

  if (fetchErr || !item) return { error: fetchErr?.message ?? "Item not found" };

  const newQty = Math.max(0, (item.quantity ?? 0) + delta);

  // Cap reason at 500 chars to keep notes column from being abused
  const trimmedReason = reason?.slice(0, 500);

  const { error } = await supabase
    .from("inv_items")
    .update({
      quantity:   newQty,
      updated_at: new Date().toISOString(),
      notes:      trimmedReason
        ? `${item.notes ? item.notes + "\n" : ""}[${new Date().toISOString().slice(0, 10)}] ${
            delta > 0 ? "+" : ""
          }${delta}: ${trimmedReason}`
        : item.notes,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/inventory/items");
  return { error: null };
}

export async function toggleItemActive(id: string, active: boolean): Promise<void> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return;

  await supabase.from("inv_items").update({ active }).eq("id", id);
  revalidatePath("/inventory/items");
}
