"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database, RollStatus } from "@/lib/database.types";

type InvRollInsert = Database["public"]["Tables"]["inv_rolls"]["Insert"];
type InvRollUpdate = Database["public"]["Tables"]["inv_rolls"]["Update"];
type InvTransactionInsert =
  Database["public"]["Tables"]["inv_transactions"]["Insert"];

// ─── Schema ─────────────────────────────────────────────────────────────────
const ROLL_STATUSES = [
  "available",
  "planned",
  "allocated",
  "staged",
  "dispatched",
  "consumed",
  "damaged",
  "returned",
] as const;

const ROLL_TYPES = ["parent", "child"] as const;

const rollSchema = z.object({
  tt_sku_tag_number:        z.string().min(1, "TT SKU is required"),
  manufacturer_roll_number: z.string().optional(),
  vendor_id:                z.string().uuid().optional().or(z.literal("")),
  product_id:               z.string().uuid().optional().or(z.literal("")),
  dye_lot:                  z.string().optional(),
  width_ft:                 z.coerce.number().nonnegative().optional(),
  original_length_ft:       z.coerce.number().nonnegative().optional(),
  current_length_ft:        z.coerce.number().nonnegative().optional(),
  location_id:              z.string().uuid().optional().or(z.literal("")),
  status:                   z.enum(ROLL_STATUSES).default("available"),
  roll_type:                z.enum(ROLL_TYPES).default("parent"),
  notes:                    z.string().optional(),
});

export type RollFormState = { error: string | null; success: boolean };

const initialState: RollFormState = { error: null, success: false };
export { initialState as ROLL_FORM_INITIAL_STATE };

function emptyToNull<T extends string | undefined>(value: T): string | null {
  if (value === undefined || value === null || value === "") return null;
  return value;
}

// ─── createRoll ─────────────────────────────────────────────────────────────
export async function createRoll(
  _prev: RollFormState,
  formData: FormData,
): Promise<RollFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = rollSchema.safeParse({
    tt_sku_tag_number:        formData.get("tt_sku_tag_number"),
    manufacturer_roll_number: formData.get("manufacturer_roll_number") || undefined,
    vendor_id:                formData.get("vendor_id") || undefined,
    product_id:               formData.get("product_id") || undefined,
    dye_lot:                  formData.get("dye_lot") || undefined,
    width_ft:                 formData.get("width_ft") || undefined,
    original_length_ft:       formData.get("original_length_ft") || undefined,
    location_id:              formData.get("location_id") || undefined,
    status:                   (formData.get("status") as string) || "available",
    roll_type:                (formData.get("roll_type") as string) || "parent",
    notes:                    formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((e) => e.message).join(", "),
      success: false,
    };
  }

  // Look up product name to denormalize
  let productName: string | null = null;
  const productId = emptyToNull(parsed.data.product_id);
  if (productId) {
    const { data: product } = await supabase
      .from("inv_products")
      .select("name")
      .eq("id", productId)
      .single();
    productName = product?.name ?? null;
  }

  const originalLength = parsed.data.original_length_ft ?? null;
  const currentLength = originalLength;

  const insertPayload: InvRollInsert = {
    tt_sku_tag_number:        parsed.data.tt_sku_tag_number,
    manufacturer_roll_number: parsed.data.manufacturer_roll_number ?? null,
    vendor_id:                emptyToNull(parsed.data.vendor_id),
    product_id:               productId,
    product_name:             productName,
    dye_lot:                  parsed.data.dye_lot ?? null,
    width_ft:                 parsed.data.width_ft ?? null,
    original_length_ft:       originalLength,
    current_length_ft:        currentLength,
    location_id:              emptyToNull(parsed.data.location_id),
    status:                   parsed.data.status,
    roll_type:                parsed.data.roll_type,
    notes:                    parsed.data.notes ?? null,
  };

  const { data: newRoll, error: insertErr } = await (
    supabase
      .from("inv_rolls")
      .insert(insertPayload as unknown as InvRollInsert)
      .select()
      .single()
  );

  if (insertErr || !newRoll) {
    return {
      error: insertErr?.message ?? "Failed to create roll",
      success: false,
    };
  }

  // Insert receive transaction
  const txPayload: InvTransactionInsert = {
    transaction_type: "receive",
    roll_id:          newRoll.id,
    to_status:        "available",
    quantity_ft:      originalLength,
    created_by:       user.id,
    notes:            `Received roll ${parsed.data.tt_sku_tag_number}`,
  };

  await (
    supabase
      .from("inv_transactions")
      .insert(txPayload as unknown as InvTransactionInsert)
  );

  revalidatePath("/inventory/rolls");
  redirect(`/inventory/rolls/${newRoll.id}`);
}

// ─── updateRoll ─────────────────────────────────────────────────────────────
export async function updateRoll(
  _prev: RollFormState,
  formData: FormData,
): Promise<RollFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const id = formData.get("id") as string;
  if (!id) return { error: "Roll ID required", success: false };

  const parsed = rollSchema.safeParse({
    tt_sku_tag_number:        formData.get("tt_sku_tag_number"),
    manufacturer_roll_number: formData.get("manufacturer_roll_number") || undefined,
    vendor_id:                formData.get("vendor_id") || undefined,
    product_id:               formData.get("product_id") || undefined,
    dye_lot:                  formData.get("dye_lot") || undefined,
    width_ft:                 formData.get("width_ft") || undefined,
    original_length_ft:       formData.get("original_length_ft") || undefined,
    current_length_ft:        formData.get("current_length_ft") || undefined,
    location_id:              formData.get("location_id") || undefined,
    status:                   (formData.get("status") as string) || "available",
    roll_type:                (formData.get("roll_type") as string) || "parent",
    notes:                    formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((e) => e.message).join(", "),
      success: false,
    };
  }

  // Fetch existing for status change detection
  const { data: existing } = await supabase
    .from("inv_rolls")
    .select("status, current_length_ft")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Roll not found", success: false };

  // Look up product name to denormalize
  let productName: string | null = null;
  const productId = emptyToNull(parsed.data.product_id);
  if (productId) {
    const { data: product } = await supabase
      .from("inv_products")
      .select("name")
      .eq("id", productId)
      .single();
    productName = product?.name ?? null;
  }

  const updatePayload: InvRollUpdate = {
    tt_sku_tag_number:        parsed.data.tt_sku_tag_number,
    manufacturer_roll_number: parsed.data.manufacturer_roll_number ?? null,
    vendor_id:                emptyToNull(parsed.data.vendor_id),
    product_id:               productId,
    product_name:             productName,
    dye_lot:                  parsed.data.dye_lot ?? null,
    width_ft:                 parsed.data.width_ft ?? null,
    original_length_ft:       parsed.data.original_length_ft ?? null,
    current_length_ft:        parsed.data.current_length_ft ?? null,
    location_id:              emptyToNull(parsed.data.location_id),
    status:                   parsed.data.status,
    roll_type:                parsed.data.roll_type,
    notes:                    parsed.data.notes ?? null,
    updated_at:               new Date().toISOString(),
  };

  const { error: updateErr } = await supabase
    .from("inv_rolls")
    .update(updatePayload as unknown as InvRollUpdate)
    .eq("id", id);

  if (updateErr) return { error: updateErr.message, success: false };

  // If status changed, insert a transaction
  if (existing.status !== parsed.data.status) {
    const txPayload: InvTransactionInsert = {
      transaction_type: "status_change",
      roll_id:          id,
      from_status:      existing.status,
      to_status:        parsed.data.status,
      quantity_ft:      parsed.data.current_length_ft ?? existing.current_length_ft ?? null,
      created_by:       user.id,
      notes:            `Status changed from ${existing.status} to ${parsed.data.status}`,
    };
    await (
      supabase
        .from("inv_transactions")
        .insert(txPayload as unknown as InvTransactionInsert)
    );
  }

  revalidatePath("/inventory/rolls");
  revalidatePath(`/inventory/rolls/${id}`);
  return { error: null, success: true };
}

// ─── cutRoll ────────────────────────────────────────────────────────────────
const cutSchema = z.object({
  parent_roll_id: z.string().uuid("Parent roll required"),
  cut_length_ft:  z.coerce.number().positive("Cut length must be positive"),
  notes:          z.string().optional(),
});

export type CutRollState = { error: string | null; success: boolean };

export async function cutRoll(
  _prev: CutRollState,
  formData: FormData,
): Promise<CutRollState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = cutSchema.safeParse({
    parent_roll_id: formData.get("parent_roll_id"),
    cut_length_ft:  formData.get("cut_length_ft"),
    notes:          formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((e) => e.message).join(", "),
      success: false,
    };
  }

  const { parent_roll_id, cut_length_ft, notes } = parsed.data;

  // Fetch parent
  const { data: parent, error: parentErr } = await supabase
    .from("inv_rolls")
    .select("*")
    .eq("id", parent_roll_id)
    .single();

  if (parentErr || !parent) {
    return { error: "Parent roll not found", success: false };
  }

  if (parent.roll_type !== "parent") {
    return { error: "Only parent rolls can be cut", success: false };
  }

  const currentLen = parent.current_length_ft ?? 0;
  if (cut_length_ft > currentLen) {
    return {
      error: `Cut length (${cut_length_ft}ft) exceeds remaining length (${currentLen}ft)`,
      success: false,
    };
  }

  // Determine child sequence number — count existing children
  const { count: childCount } = await supabase
    .from("inv_rolls")
    .select("id", { count: "exact", head: true })
    .eq("parent_roll_id", parent_roll_id);

  const seq = (childCount ?? 0) + 1;
  const baseSku = parent.tt_sku_tag_number ?? `R-${parent.id.slice(0, 6)}`;
  const childSku = `${baseSku}-C${seq}`;

  // Create child
  const newParentLen = Number((currentLen - cut_length_ft).toFixed(4));
  const childInsert: InvRollInsert = {
    tt_sku_tag_number:        childSku,
    manufacturer_roll_number: parent.manufacturer_roll_number,
    vendor_id:                parent.vendor_id,
    product_id:               parent.product_id,
    product_name:             parent.product_name,
    dye_lot:                  parent.dye_lot,
    width_ft:                 parent.width_ft,
    original_length_ft:       cut_length_ft,
    current_length_ft:        cut_length_ft,
    status:                   "available",
    roll_type:                "child",
    parent_roll_id:           parent.id,
    location_id:              parent.location_id,
    notes:                    notes ?? null,
  };

  const { data: child, error: childErr } = await (
    supabase
      .from("inv_rolls")
      .insert(childInsert as unknown as InvRollInsert)
      .select()
      .single()
  );

  if (childErr || !child) {
    return {
      error: childErr?.message ?? "Failed to create child roll",
      success: false,
    };
  }

  // Update parent
  const parentNewStatus: RollStatus =
    newParentLen <= 0 ? "consumed" : (parent.status as RollStatus);
  const parentUpdate: InvRollUpdate = {
    current_length_ft: newParentLen,
    status:            parentNewStatus,
    updated_at:        new Date().toISOString(),
  };

  await supabase
    .from("inv_rolls")
    .update(parentUpdate as unknown as InvRollUpdate)
    .eq("id", parent.id);

  // Insert transactions — one for the parent (cut), one for the child (cut_created)
  const parentTx: InvTransactionInsert = {
    transaction_type: "cut",
    roll_id:          parent.id,
    from_status:      parent.status,
    to_status:        parentNewStatus,
    quantity_ft:      cut_length_ft,
    created_by:       user.id,
    notes:            `Cut ${cut_length_ft}ft → child ${childSku}`,
  };
  const childTx: InvTransactionInsert = {
    transaction_type: "cut_created",
    roll_id:          child.id,
    to_status:        "available",
    quantity_ft:      cut_length_ft,
    created_by:       user.id,
    notes:            `Created from parent ${baseSku}`,
  };

  await (
    supabase
      .from("inv_transactions")
      .insert([
        parentTx as unknown as InvTransactionInsert,
        childTx as unknown as InvTransactionInsert,
      ])
  );

  revalidatePath("/inventory/rolls");
  revalidatePath(`/inventory/rolls/${parent.id}`);
  revalidatePath(`/inventory/rolls/${child.id}`);
  redirect(`/inventory/rolls/${child.id}`);
}
