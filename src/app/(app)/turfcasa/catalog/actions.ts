"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const priceSchema = z.object({
  product_id:   z.string().uuid(),
  retail_price: z.coerce.number().nonnegative().nullable(),
  trade_price:  z.coerce.number().nonnegative().nullable(),
});

/** Admin-only (RLS enforces): set the retail/trade price on a catalog SKU. */
export async function updateProductPrices(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const retailRaw = String(formData.get("retail_price") ?? "").trim();
  const tradeRaw = String(formData.get("trade_price") ?? "").trim();
  const parsed = priceSchema.safeParse({
    product_id:   formData.get("product_id"),
    retail_price: retailRaw === "" ? null : retailRaw,
    trade_price:  tradeRaw === "" ? null : tradeRaw,
  });
  if (!parsed.success) return;

  await supabase
    .from("turfcasa_products")
    .update({
      retail_price: parsed.data.retail_price,
      trade_price:  parsed.data.trade_price,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", parsed.data.product_id);

  revalidatePath("/turfcasa/catalog");
}
