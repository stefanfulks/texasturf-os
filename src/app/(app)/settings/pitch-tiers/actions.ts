"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "../_lib/require-admin";

export type TierFormState = { error: string | null; success: boolean };

const tierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Name required"),
  product_label: z.string().min(1, "Product label required"),
  pricing_key: z.string().min(1, "Pricing key required"),
  inv_product_id: z.string().optional(),
  target_margin: z.coerce.number().min(30).max(70),
  infill_mode: z.enum(["standard", "none"]),
  inclusions: z.string(),
});

export async function updateTier(_prev: TierFormState, formData: FormData): Promise<TierFormState> {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false };

  const parsed = tierSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    product_label: formData.get("product_label"),
    pricing_key: formData.get("pricing_key"),
    inv_product_id: formData.get("inv_product_id") || undefined,
    target_margin: formData.get("target_margin"),
    infill_mode: formData.get("infill_mode"),
    inclusions: formData.get("inclusions") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const inclusions = parsed.data.inclusions.split("\n").map((s) => s.trim()).filter(Boolean);

  const { error } = await supabase.from("pitch_tiers").update({
    name: parsed.data.name,
    product_label: parsed.data.product_label,
    pricing_key: parsed.data.pricing_key,
    inv_product_id: parsed.data.inv_product_id ?? null,
    target_margin: parsed.data.target_margin,
    infill_mode: parsed.data.infill_mode,
    inclusions,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.id);

  if (error) return { error: error.message, success: false };
  revalidatePath("/settings/pitch-tiers");
  return { error: null, success: true };
}
