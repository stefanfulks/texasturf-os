"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const productSchema = z.object({
  name:        z.string().min(1, "Name is required"),
  sku:         z.string().optional(),
  width_ft:    z.coerce.number().positive().optional(),
  description: z.string().optional(),
});

export type ProductFormState = { error: string | null; success: boolean };

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const widthRaw = formData.get("width_ft");

  const parsed = productSchema.safeParse({
    name:        formData.get("name"),
    sku:         formData.get("sku") || undefined,
    width_ft:    widthRaw === "" || widthRaw == null ? undefined : widthRaw,
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase.from("inv_products").insert({
    name:        parsed.data.name,
    sku:         parsed.data.sku ?? null,
    width_ft:    parsed.data.width_ft ?? null,
    description: parsed.data.description ?? null,
  });

  if (error) return { error: error.message, success: false };

  revalidatePath("/inventory/products");
  return { error: null, success: true };
}

export async function updateProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const id = formData.get("id") as string;
  if (!id) return { error: "Product ID required", success: false };

  const widthRaw = formData.get("width_ft");
  const parsed = productSchema.safeParse({
    name:        formData.get("name"),
    sku:         formData.get("sku") || undefined,
    width_ft:    widthRaw === "" || widthRaw == null ? undefined : widthRaw,
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase.from("inv_products").update({
    name:        parsed.data.name,
    sku:         parsed.data.sku ?? null,
    width_ft:    parsed.data.width_ft ?? null,
    description: parsed.data.description ?? null,
  }).eq("id", id);

  if (error) return { error: error.message, success: false };

  revalidatePath("/inventory/products");
  return { error: null, success: true };
}

export async function toggleProductActive(id: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("inv_products").update({ active }).eq("id", id);
  revalidatePath("/inventory/products");
}
