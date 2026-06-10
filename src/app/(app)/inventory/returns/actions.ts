"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOfficeOrAdmin } from "../_lib/require-role";
import type { InvRoll, InvProduct } from "@/lib/db-helpers.types";

// ─── Process Returns (from job) ───────────────────────────────────────────────

const processReturnsSchema = z.object({
  job_id: z.string().uuid(),
  rolls: z
    .array(
      z.object({
        roll_id:        z.string().uuid(),
        returned_length: z.coerce.number().min(0),
        notes:           z.string().optional(),
      }),
    )
    .min(1, "Pick at least one roll to return."),
});

export type ProcessReturnsState = {
  error: string | null;
  processedCount: number;
};

export async function processReturns(formData: FormData): Promise<ProcessReturnsState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  const user = auth.user;
  if (!user) return { error: auth.error, processedCount: 0 };

  const jobId = formData.get("job_id") as string | null;
  if (!jobId) return { error: "Missing job id", processedCount: 0 };

  // Build rolls payload from form fields. The client sends a JSON blob in
  // "rolls" so we don't have to bracket-name a dynamic list.
  const rollsJson = formData.get("rolls") as string | null;
  if (!rollsJson) return { error: "No rolls selected", processedCount: 0 };

  let rollsInput: unknown;
  try {
    rollsInput = JSON.parse(rollsJson);
  } catch {
    return { error: "Malformed roll selection", processedCount: 0 };
  }

  const parsed = processReturnsSchema.safeParse({ job_id: jobId, rolls: rollsInput });
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
      processedCount: 0,
    };
  }

  const { rolls } = parsed.data;
  const rollIds = rolls.map((r) => r.roll_id);

  // Fetch current state of every roll we'll touch.
  const { data: rollsCurrent } = await supabase
    .from("inv_rolls")
    .select("id, status, current_length_ft, tt_sku_tag_number, allocated_job_id")
    .in("id", rollIds);

  const currentRolls = (rollsCurrent ?? []) as unknown as Pick<
    InvRoll,
    "id" | "status" | "current_length_ft" | "tt_sku_tag_number" | "allocated_job_id"
  >[];
  const byId = new Map(currentRolls.map((r) => [r.id, r]));

  let processed = 0;

  for (const r of rolls) {
    const current = byId.get(r.roll_id);
    if (!current) continue;

    const maxLength = current.current_length_ft ?? 0;
    if (r.returned_length > maxLength) {
      return {
        error: `Roll ${current.tt_sku_tag_number ?? r.roll_id.slice(0, 6)}: returned length ${r.returned_length} > current length ${maxLength}`,
        processedCount: processed,
      };
    }

    const newStatus = r.returned_length > 0 ? "returned" : "consumed";
    const newLength = r.returned_length > 0 ? r.returned_length : 0;

    const { error: updErr } = await supabase
      .from("inv_rolls")
      .update({
        status:            newStatus,
        current_length_ft: newLength,
        allocated_job_id:  null,
      })
      .eq("id", r.roll_id);
    if (updErr) {
      return {
        error: `Roll ${current.tt_sku_tag_number ?? r.roll_id.slice(0, 6)}: ${updErr.message}`,
        processedCount: processed,
      };
    }

    await supabase.from("inv_transactions").insert({
      transaction_type: "return",
      roll_id:          r.roll_id,
      job_id:           jobId,
      from_status:      current.status,
      to_status:        newStatus,
      quantity_ft:      r.returned_length,
      notes:            r.notes ?? null,
      created_by:       user.id,
    });

    processed++;
  }

  // Mark this job's open allocations for these rolls as completed.
  await supabase
    .from("inv_allocations")
    .update({ status: "completed" })
    .eq("job_id", jobId)
    .in("roll_id", rollIds)
    .not("status", "in", "(completed,cancelled)");

  revalidatePath("/inventory/returns");
  revalidatePath("/inventory/returns/pending");
  revalidatePath("/inventory/rolls");
  revalidatePath("/inventory/jobs");
  revalidatePath(`/inventory/jobs/${jobId}`);
  revalidatePath("/inventory");

  return { error: null, processedCount: processed };
}

// ─── Unmarked Return ──────────────────────────────────────────────────────────

const unmarkedReturnSchema = z.object({
  tt_sku_tag_number: z.string().min(1, "Tag number required"),
  product_id:        z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  returned_length:   z.coerce.number().positive("Returned length must be > 0"),
  width_ft:          z.coerce.number().positive().optional(),
  dye_lot:           z.string().optional(),
  condition:         z.enum(["good", "damaged"]),
  notes:             z.string().optional(),
});

export type UnmarkedReturnState = {
  error: string | null;
  rollId: string | null;
  matched: "updated" | "created" | null;
};

export async function processUnmarkedReturn(
  _prev: UnmarkedReturnState,
  formData: FormData,
): Promise<UnmarkedReturnState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  const user = auth.user;
  if (!user) return { error: auth.error, rollId: null, matched: null };

  const parsed = unmarkedReturnSchema.safeParse({
    tt_sku_tag_number: formData.get("tt_sku_tag_number"),
    product_id:        formData.get("product_id"),
    returned_length:   formData.get("returned_length"),
    width_ft:          formData.get("width_ft") || undefined,
    dye_lot:           formData.get("dye_lot") || undefined,
    condition:         formData.get("condition"),
    notes:             formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
      rollId: null,
      matched: null,
    };
  }

  const d = parsed.data;
  const targetStatus = d.condition === "damaged" ? "damaged" : "returned";

  // Look up an existing roll by tt_sku_tag_number
  const { data: existingData } = await supabase
    .from("inv_rolls")
    .select("id, status, current_length_ft, allocated_job_id, tt_sku_tag_number")
    .eq("tt_sku_tag_number", d.tt_sku_tag_number.trim())
    .maybeSingle();

  const existing = existingData as unknown as Pick<
    InvRoll,
    "id" | "status" | "current_length_ft" | "allocated_job_id" | "tt_sku_tag_number"
  > | null;

  let rollId: string;
  let matched: "updated" | "created";

  if (existing) {
    const prevStatus = existing.status;
    const { error: updErr } = await supabase
      .from("inv_rolls")
      .update({
        status:            targetStatus,
        current_length_ft: d.returned_length,
        allocated_job_id:  null,
        notes:             d.notes ?? null,
      })
      .eq("id", existing.id);
    if (updErr) return { error: updErr.message, rollId: null, matched: null };

    await supabase.from("inv_transactions").insert({
      transaction_type: "return_unmarked",
      roll_id:          existing.id,
      from_status:      prevStatus,
      to_status:        targetStatus,
      quantity_ft:      d.returned_length,
      notes:            d.notes ?? "Unmarked return — matched existing tag",
      created_by:       user.id,
    });

    rollId = existing.id;
    matched = "updated";
  } else {
    // Create a new roll with the provided tag, in returned status.
    let productName: string | null = null;
    let widthFromProduct: number | null = null;
    if (d.product_id) {
      const { data: product } = await supabase
        .from("inv_products")
        .select("name, width_ft")
        .eq("id", d.product_id)
        .single();
      if (product) {
        const p = product as unknown as Pick<InvProduct, "name" | "width_ft">;
        productName = p.name;
        widthFromProduct = p.width_ft;
      }
    }
    const width = d.width_ft ?? widthFromProduct ?? null;

    const { data: created, error: insertErr } = await supabase
      .from("inv_rolls")
      .insert({
        tt_sku_tag_number:  d.tt_sku_tag_number.trim(),
        product_id:         d.product_id ?? null,
        product_name:       productName,
        dye_lot:            d.dye_lot ?? null,
        width_ft:           width,
        original_length_ft: d.returned_length,
        current_length_ft:  d.returned_length,
        status:             targetStatus,
        roll_type:          "parent",
        notes:              d.notes ?? "Unmarked return — no prior record",
      })
      .select("id")
      .single();

    if (insertErr || !created) {
      return { error: insertErr?.message ?? "Failed to create roll", rollId: null, matched: null };
    }

    await supabase.from("inv_transactions").insert({
      transaction_type: "return_unmarked",
      roll_id:          created.id,
      from_status:      null,
      to_status:        targetStatus,
      quantity_ft:      d.returned_length,
      notes:            d.notes ?? "Unmarked return — new record",
      created_by:       user.id,
    });

    rollId = created.id;
    matched = "created";
  }

  revalidatePath("/inventory/returns");
  revalidatePath("/inventory/returns/pending");
  revalidatePath("/inventory/rolls");
  revalidatePath("/inventory");

  return { error: null, rollId, matched };
}

// ─── Pending Returns review ───────────────────────────────────────────────────

export type RestockState = { error: string | null; success: boolean };

export async function restockReturnedRoll(
  _prev: RestockState,
  formData: FormData,
): Promise<RestockState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  const user = auth.user;
  if (!user) return { error: auth.error, success: false };

  const rollId = formData.get("roll_id") as string | null;
  if (!rollId) return { error: "Missing roll id", success: false };

  const { data: rollData } = await supabase
    .from("inv_rolls")
    .select("id, status, current_length_ft")
    .eq("id", rollId)
    .single();
  if (!rollData) return { error: "Roll not found", success: false };
  const roll = rollData as unknown as Pick<InvRoll, "id" | "status" | "current_length_ft">;
  const prevStatus = roll.status;

  const { error: updErr } = await supabase
    .from("inv_rolls")
    .update({ status: "available" })
    .eq("id", rollId);
  if (updErr) return { error: updErr.message, success: false };

  await supabase.from("inv_transactions").insert({
    transaction_type: "return_review",
    roll_id:          rollId,
    from_status:      prevStatus,
    to_status:        "available",
    quantity_ft:      roll.current_length_ft,
    notes:            "Restocked to Available after return review",
    created_by:       user.id,
  });

  revalidatePath("/inventory/returns/pending");
  revalidatePath("/inventory/rolls");
  revalidatePath("/inventory");
  return { error: null, success: true };
}

export async function markReturnedDamaged(
  _prev: RestockState,
  formData: FormData,
): Promise<RestockState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  const user = auth.user;
  if (!user) return { error: auth.error, success: false };

  const rollId = formData.get("roll_id") as string | null;
  if (!rollId) return { error: "Missing roll id", success: false };

  const { data: rollData } = await supabase
    .from("inv_rolls")
    .select("id, status, current_length_ft, notes")
    .eq("id", rollId)
    .single();
  if (!rollData) return { error: "Roll not found", success: false };
  const roll = rollData as unknown as Pick<
    InvRoll,
    "id" | "status" | "current_length_ft" | "notes"
  >;
  const prevStatus = roll.status;

  const { error: updErr } = await supabase
    .from("inv_rolls")
    .update({ status: "damaged" })
    .eq("id", rollId);
  if (updErr) return { error: updErr.message, success: false };

  await supabase.from("inv_transactions").insert({
    transaction_type: "return_review",
    roll_id:          rollId,
    from_status:      prevStatus,
    to_status:        "damaged",
    quantity_ft:      roll.current_length_ft,
    notes:            "Marked damaged after return review",
    created_by:       user.id,
  });

  revalidatePath("/inventory/returns/pending");
  revalidatePath("/inventory/rolls");
  revalidatePath("/inventory");
  return { error: null, success: true };
}
