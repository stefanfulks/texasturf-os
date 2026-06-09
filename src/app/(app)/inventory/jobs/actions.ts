"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOfficeOrAdmin } from "../_lib/require-role";

// ─── Shared form state ────────────────────────────────────────────────────────

export type JobFormState        = { error: string | null; success: boolean };
export type AllocationFormState = { error: string | null; success: boolean };

const initialError = (msg: string): JobFormState => ({ error: msg, success: false });

// ─── Schemas ──────────────────────────────────────────────────────────────────

const jobSchema = z.object({
  job_number:     z.string().optional(),
  job_name:       z.string().min(1, "Job name is required"),
  site_address:   z.string().optional(),
  scheduled_date: z.string().optional(),
  status:         z.string().optional(),
  notes:          z.string().optional(),
});

const allocationSchema = z.object({
  product_id:           z.string().optional(),
  product_name:         z.string().optional(),
  width_ft:             z.coerce.number().positive().optional(),
  dye_lot_preference:   z.string().optional(),
  requested_length_ft:  z.coerce.number().positive().optional(),
  notes:                z.string().optional(),
}).refine((d) => !!d.product_id || !!d.product_name, {
  message: "Either a product or a product name is required",
});

// ─── Create / Update Job ──────────────────────────────────────────────────────

export async function createJob(
  _prev: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return initialError(auth.error);
  const user = auth.user;

  const parsed = jobSchema.safeParse({
    job_number:     formData.get("job_number")     || undefined,
    job_name:       formData.get("job_name"),
    site_address:   formData.get("site_address")   || undefined,
    scheduled_date: formData.get("scheduled_date") || undefined,
    status:         formData.get("status")         || "planning",
    notes:          formData.get("notes")          || undefined,
  });

  if (!parsed.success) {
    return initialError(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const { data, error } = await supabase.from("inv_jobs").insert({
    job_number:     parsed.data.job_number     ?? null,
    job_name:       parsed.data.job_name,
    site_address:   parsed.data.site_address   ?? null,
    scheduled_date: parsed.data.scheduled_date ?? null,
    status:         parsed.data.status         ?? "planning",
    notes:          parsed.data.notes          ?? null,
    created_by:     user.id,
  }).select().single();

  if (error || !data) return initialError(error?.message ?? "Failed to create job");

  revalidatePath("/inventory/jobs");
  redirect(`/inventory/jobs/${data.id}`);
}

export async function updateJob(
  _prev: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return initialError(auth.error);

  const id = formData.get("id") as string;
  if (!id) return initialError("Job ID required");

  const parsed = jobSchema.safeParse({
    job_number:     formData.get("job_number")     || undefined,
    job_name:       formData.get("job_name"),
    site_address:   formData.get("site_address")   || undefined,
    scheduled_date: formData.get("scheduled_date") || undefined,
    status:         formData.get("status")         || undefined,
    notes:          formData.get("notes")          || undefined,
  });

  if (!parsed.success) {
    return initialError(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const { error } = await supabase.from("inv_jobs").update({
    job_number:     parsed.data.job_number     ?? null,
    job_name:       parsed.data.job_name,
    site_address:   parsed.data.site_address   ?? null,
    scheduled_date: parsed.data.scheduled_date ?? null,
    status:         parsed.data.status         ?? "planning",
    notes:          parsed.data.notes          ?? null,
    updated_at:     new Date().toISOString(),
  }).eq("id", id);

  if (error) return initialError(error.message);

  revalidatePath("/inventory/jobs");
  revalidatePath(`/inventory/jobs/${id}`);
  return { error: null, success: true };
}

// ─── Job status workflow ──────────────────────────────────────────────────────

async function setJobStatus(
  jobId: string,
  status: "planning" | "in_progress" | "staged" | "completed" | "archived",
  extra?: { completion_date?: string | null },
): Promise<string> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) throw new Error(auth.error);

  const { error } = await supabase.from("inv_jobs").update({
    status,
    updated_at: new Date().toISOString(),
    ...(extra?.completion_date !== undefined ? { completion_date: extra.completion_date } : {}),
  }).eq("id", jobId);

  if (error) throw new Error(error.message);
  return auth.user.id;
}

export async function markJobInProgress(jobId: string): Promise<void> {
  try { await setJobStatus(jobId, "in_progress"); } catch { return; }
  revalidatePath("/inventory/jobs");
  revalidatePath(`/inventory/jobs/${jobId}`);
}

/**
 * Bulk version of the staged/completed transition: 4 queries total instead
 * of 4 per allocation. Previous N+1 loop made the warehouse hot path scale
 * linearly with allocation count (50 allocs → 200 round-trips).
 */
async function transitionJobAllocations(
  jobId: string,
  userId: string,
  spec: {
    allocStatus: string;       // new status for inv_allocations rows
    rollStatus: string;        // new status for inv_rolls rows
    transactionType: string;   // inv_transactions.transaction_type
    fromDefault: string;       // fallback from_status if roll has none
    notes: string;
    timestamp: string;
  },
): Promise<void> {
  const supabase = await createClient();

  const { data: allocs } = await supabase
    .from("inv_allocations")
    .select("id, roll_id, requested_length_ft")
    .eq("job_id", jobId)
    .not("roll_id", "is", null);

  const rows = (allocs ?? []).filter((a): a is typeof a & { roll_id: string } => !!a.roll_id);
  if (rows.length === 0) return;

  const rollIds = rows.map((r) => r.roll_id);
  const allocIds = rows.map((r) => r.id);

  // 1 query: bulk fetch prior roll statuses for the audit log.
  const { data: rolls } = await supabase
    .from("inv_rolls")
    .select("id, status")
    .in("id", rollIds);
  const fromByRoll = new Map<string, string>();
  for (const r of rolls ?? []) {
    if (r.status) fromByRoll.set(r.id, r.status as string);
  }

  // 2 queries: bulk update allocations + rolls. Status casts mirror the
  // existing per-row pattern — the spec.allocStatus/rollStatus values are
  // literal enum members but the helper widens them to string.
  await supabase
    .from("inv_allocations")
    .update({ status: spec.allocStatus as never, updated_at: spec.timestamp })
    .in("id", allocIds);

  await supabase
    .from("inv_rolls")
    .update({ status: spec.rollStatus as never, updated_at: spec.timestamp })
    .in("id", rollIds);

  // 1 query: bulk insert the transaction audit log.
  const txRows = rows.map((alloc) => ({
    transaction_type: spec.transactionType,
    roll_id:          alloc.roll_id,
    job_id:           jobId,
    from_status:      fromByRoll.get(alloc.roll_id) ?? spec.fromDefault,
    to_status:        spec.rollStatus,
    quantity_ft:      alloc.requested_length_ft ?? null,
    notes:            spec.notes,
    created_by:       userId,
  }));
  await supabase.from("inv_transactions").insert(txRows);
}

export async function markJobStaged(jobId: string): Promise<void> {
  try {
    const userId = await setJobStatus(jobId, "staged");
    await transitionJobAllocations(jobId, userId, {
      allocStatus: "staged",
      rollStatus: "staged",
      transactionType: "stage",
      fromDefault: "allocated",
      notes: "Staged for job",
      timestamp: new Date().toISOString(),
    });
    revalidatePath("/inventory/jobs");
    revalidatePath(`/inventory/jobs/${jobId}`);
  } catch { /* silently denied — role gate or DB error */ }
}

export async function markJobCompleted(jobId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    const userId = await setJobStatus(jobId, "completed", { completion_date: now });
    await transitionJobAllocations(jobId, userId, {
      allocStatus: "completed",
      rollStatus: "dispatched",
      transactionType: "dispatch",
      fromDefault: "staged",
      notes: "Dispatched on job completion",
      timestamp: now,
    });
    revalidatePath("/inventory/jobs");
    revalidatePath(`/inventory/jobs/${jobId}`);
  } catch { /* silently denied */ }
}

export async function archiveJob(jobId: string): Promise<void> {
  try { await setJobStatus(jobId, "archived"); } catch { return; }
  revalidatePath("/inventory/jobs");
  revalidatePath("/inventory/jobs/archived");
  revalidatePath(`/inventory/jobs/${jobId}`);
}

export async function restoreJob(jobId: string): Promise<void> {
  try { await setJobStatus(jobId, "planning"); } catch { return; }
  revalidatePath("/inventory/jobs");
  revalidatePath("/inventory/jobs/archived");
  revalidatePath(`/inventory/jobs/${jobId}`);
}

// ─── Allocations ──────────────────────────────────────────────────────────────

export async function createAllocation(
  _prev: AllocationFormState,
  formData: FormData,
): Promise<AllocationFormState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false };

  const jobId = formData.get("job_id") as string;
  if (!jobId) return { error: "Job ID required", success: false };

  const productIdRaw = formData.get("product_id");
  const productId    = typeof productIdRaw === "string" && productIdRaw.length > 0 ? productIdRaw : undefined;

  const parsed = allocationSchema.safeParse({
    product_id:          productId,
    product_name:        formData.get("product_name")        || undefined,
    width_ft:            formData.get("width_ft")            || undefined,
    dye_lot_preference:  formData.get("dye_lot_preference")  || undefined,
    requested_length_ft: formData.get("requested_length_ft") || undefined,
    notes:               formData.get("notes")               || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  // If a product was selected by id, also denormalize the name for display.
  let productName = parsed.data.product_name ?? null;
  if (parsed.data.product_id && !productName) {
    const { data: prod } = await supabase
      .from("inv_products")
      .select("name")
      .eq("id", parsed.data.product_id)
      .single();
    productName = prod?.name ?? null;
  }

  const { error } = await supabase.from("inv_allocations").insert({
    job_id:              jobId,
    product_id:          parsed.data.product_id           ?? null,
    product_name:        productName,
    width_ft:            parsed.data.width_ft            ?? null,
    dye_lot_preference:  parsed.data.dye_lot_preference  ?? null,
    requested_length_ft: parsed.data.requested_length_ft ?? null,
    status:              "requested",
    notes:               parsed.data.notes               ?? null,
  });

  if (error) return { error: error.message, success: false };

  revalidatePath(`/inventory/jobs/${jobId}`);
  redirect(`/inventory/jobs/${jobId}`);
}

export async function deleteAllocation(allocId: string): Promise<void> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return;

  const { data: alloc } = await supabase
    .from("inv_allocations")
    .select("job_id, roll_id, status")
    .eq("id", allocId)
    .single();

  if (!alloc) return;

  // Allocations with a roll already attached must be unassigned first.
  if (alloc.roll_id) {
    await unassignRoll(allocId);
  }

  await supabase.from("inv_allocations").delete().eq("id", allocId);

  revalidatePath(`/inventory/jobs/${alloc.job_id}`);
}

// ─── Assign / unassign / swap rolls ───────────────────────────────────────────

export async function assignRoll(allocId: string, rollId: string): Promise<void> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return;
  const user = auth.user;

  const { data: alloc } = await supabase
    .from("inv_allocations")
    .select("id, job_id, requested_length_ft")
    .eq("id", allocId)
    .single();
  if (!alloc) return;

  const { data: roll } = await supabase
    .from("inv_rolls")
    .select("id, status")
    .eq("id", rollId)
    .single();
  if (!roll) return;

  const now = new Date().toISOString();

  await supabase.from("inv_rolls").update({
    status:           "allocated",
    allocated_job_id: alloc.job_id,
    updated_at:       now,
  }).eq("id", rollId);

  await supabase.from("inv_allocations").update({
    roll_id:    rollId,
    status:     "allocated",
    updated_at: now,
  }).eq("id", allocId);

  await supabase.from("inv_transactions").insert({
    transaction_type: "allocate",
    roll_id:          rollId,
    job_id:           alloc.job_id,
    from_status:      roll.status,
    to_status:        "allocated",
    quantity_ft:      alloc.requested_length_ft ?? null,
    notes:            `Allocated to job`,
    created_by:       user.id,
  });

  revalidatePath(`/inventory/jobs/${alloc.job_id}`);
  redirect(`/inventory/jobs/${alloc.job_id}`);
}

export async function unassignRoll(allocId: string): Promise<void> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return;
  const user = auth.user;

  const { data: alloc } = await supabase
    .from("inv_allocations")
    .select("id, job_id, roll_id, requested_length_ft")
    .eq("id", allocId)
    .single();
  if (!alloc || !alloc.roll_id) return;

  const { data: roll } = await supabase
    .from("inv_rolls")
    .select("status")
    .eq("id", alloc.roll_id)
    .single();
  const fromStatus = roll?.status ?? "allocated";

  const now = new Date().toISOString();

  await supabase.from("inv_rolls").update({
    status:           "available",
    allocated_job_id: null,
    updated_at:       now,
  }).eq("id", alloc.roll_id);

  await supabase.from("inv_allocations").update({
    roll_id:    null,
    status:     "requested",
    updated_at: now,
  }).eq("id", allocId);

  await supabase.from("inv_transactions").insert({
    transaction_type: "unallocate",
    roll_id:          alloc.roll_id,
    job_id:           alloc.job_id,
    from_status:      fromStatus,
    to_status:        "available",
    quantity_ft:      alloc.requested_length_ft ?? null,
    notes:            `Released from job`,
    created_by:       user.id,
  });

  revalidatePath(`/inventory/jobs/${alloc.job_id}`);
}

export async function swapRoll(allocId: string, newRollId: string): Promise<void> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return;
  const user = auth.user;

  const { data: alloc } = await supabase
    .from("inv_allocations")
    .select("id, job_id, roll_id, requested_length_ft")
    .eq("id", allocId)
    .single();
  if (!alloc) return;

  const oldRollId = alloc.roll_id;
  const now = new Date().toISOString();

  // Release the old roll
  if (oldRollId) {
    const { data: oldRoll } = await supabase
      .from("inv_rolls")
      .select("status")
      .eq("id", oldRollId)
      .single();

    await supabase.from("inv_rolls").update({
      status:           "available",
      allocated_job_id: null,
      updated_at:       now,
    }).eq("id", oldRollId);

    await supabase.from("inv_transactions").insert({
      transaction_type: "unallocate",
      roll_id:          oldRollId,
      job_id:           alloc.job_id,
      from_status:      oldRoll?.status ?? "allocated",
      to_status:        "available",
      quantity_ft:      alloc.requested_length_ft ?? null,
      notes:            `Swapped out for replacement roll`,
      created_by:       user.id,
    });
  }

  // Assign the new roll
  const { data: newRoll } = await supabase
    .from("inv_rolls")
    .select("status")
    .eq("id", newRollId)
    .single();
  if (!newRoll) return;

  await supabase.from("inv_rolls").update({
    status:           "allocated",
    allocated_job_id: alloc.job_id,
    updated_at:       now,
  }).eq("id", newRollId);

  await supabase.from("inv_allocations").update({
    roll_id:    newRollId,
    status:     "allocated",
    updated_at: now,
  }).eq("id", allocId);

  await supabase.from("inv_transactions").insert({
    transaction_type: "allocate",
    roll_id:          newRollId,
    job_id:           alloc.job_id,
    from_status:      newRoll.status,
    to_status:        "allocated",
    quantity_ft:      alloc.requested_length_ft ?? null,
    notes:            oldRollId ? `Swapped in as replacement` : `Allocated to job`,
    created_by:       user.id,
  });

  revalidatePath(`/inventory/jobs/${alloc.job_id}`);
  redirect(`/inventory/jobs/${alloc.job_id}`);
}
