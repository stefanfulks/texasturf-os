"use server";

/**
 * Server actions for warehouse / operations mutations.
 *
 * Auth note: RLS on warehouse_* tables already restricts writes to
 * admin + office via current_role() (set in 20260606100000_warehouse_core.sql),
 * so a non-admin/office user calling these actions hits RLS. Belt-and-
 * suspenders auth-gating in the actions themselves is a TODO once we
 * wire role-aware UI affordances.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  emptyInspectionItems,
  INSPECTION_CHECKLIST,
  type InspectionItems,
  type InspectionResult,
} from "./types";

// ---------------------------------------------------------------------------
// createInspection — Equipment Inspection Checklist (Step 18)
// ---------------------------------------------------------------------------

export async function createInspection(formData: FormData) {
  const inspector = String(formData.get("inspector") ?? "").trim();
  if (!inspector) throw new Error("Inspector is required");

  const inspectorEmployeeId = nullableString(formData.get("inspector_employee_id"));
  const truckId = nullableString(formData.get("truck_id"));
  const trailerId = nullableString(formData.get("trailer_id"));
  const equipmentId = nullableString(formData.get("equipment_id"));
  const pullListId = nullableString(formData.get("pull_list_id"));
  const failureNotes = nullableString(formData.get("failure_notes"));

  const items = emptyInspectionItems();
  for (const section of INSPECTION_CHECKLIST) {
    for (const item of section.items) {
      const raw = formData.get(`items.${section.section}.${item.key}`);
      // Tri-state: "yes" | "no" | "na" (not applicable / blank)
      const v = typeof raw === "string" ? raw : "na";
      const value = v === "yes" ? true : v === "no" ? false : null;
      (items[section.section] as Record<string, boolean | null>)[item.key] = value;
    }
  }

  const computedResult: InspectionResult = computeResult(items);
  const submittedResult = formData.get("result");
  const result: InspectionResult =
    submittedResult === "pass" || submittedResult === "fail"
      ? (submittedResult as InspectionResult)
      : computedResult;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_inspections")
    .insert({
      inspector,
      inspector_employee_id: inspectorEmployeeId,
      truck_id: truckId,
      trailer_id: trailerId,
      equipment_id: equipmentId,
      pull_list_id: pullListId,
      items,
      result,
      failure_notes: failureNotes,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/operations/inspections");
  revalidatePath("/operations");
  redirect(`/operations/inspections/${data.id}`);
}

function computeResult(items: InspectionItems): InspectionResult {
  for (const section of Object.values(items)) {
    for (const value of Object.values(section as Record<string, boolean | null>)) {
      if (value === false) return "fail";
    }
  }
  return "pass";
}

// ---------------------------------------------------------------------------
// createEmployee — used by /warehouse/employees (and any inline "add" picker)
// ---------------------------------------------------------------------------

export async function createEmployee(formData: FormData) {
  const firstName = String(formData.get("first_name") ?? "").trim();
  if (!firstName) throw new Error("First name is required");
  const lastName = nullableString(formData.get("last_name"));
  // Form field is still "role" for UI continuity; column is job_role to keep
  // it distinct from profiles.role (the app permission role).
  const jobRole = nullableString(formData.get("role"));
  const email = nullableString(formData.get("email"));
  const phone = nullableString(formData.get("phone"));

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("warehouse_employees")
    .insert({ first_name: firstName, last_name: lastName, job_role: jobRole, email, phone });
  if (error) throw new Error(error.message);

  revalidatePath("/operations/employees");
}

// ---------------------------------------------------------------------------
// createAsset — used by /warehouse/assets (and inline pickers)
// ---------------------------------------------------------------------------

export async function createAsset(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  if (!["truck", "trailer", "heavy_equipment", "tool"].includes(kind)) {
    throw new Error("Invalid kind");
  }

  // Targets the existing public.assets table (not warehouse_assets — that
  // table doesn't exist in OS). unit_type is the kind selector.
  const sb = supabaseAdmin();
  const { error } = await sb.from("assets").insert({
    unit_type: kind,
    name,
    identifier: nullableString(formData.get("identifier")),
    make: nullableString(formData.get("make")),
    model: nullableString(formData.get("model")),
    year: nullableNumber(formData.get("year")),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/operations/assets");
  // Fleet page also reads from assets — keep it fresh.
  revalidatePath("/fleet");
}

// ---------------------------------------------------------------------------
// createPullList — daily material assembly form (Ivana's main workflow).
// Two-step write: insert the parent row, then bulk-insert the roll rows.
// If the rolls write fails, we delete the parent so we don't leave an
// orphaned pull list.
// ---------------------------------------------------------------------------

export async function createPullList(formData: FormData) {
  const jobDate = String(formData.get("job_date") ?? "").trim();
  if (!jobDate) throw new Error("Job date is required");

  const jobberVisitId  = nullableString(formData.get("jobber_visit_id"));
  const clientId       = nullableString(formData.get("client_id"));
  const clientName     = nullableString(formData.get("client_name"));
  const address        = nullableString(formData.get("address"));
  const jobNumber      = nullableString(formData.get("job_number"));

  const crewLeadEmployeeId = nullableString(formData.get("crew_lead_employee_id"));
  const crewLead           = nullableString(formData.get("crew_lead"));
  const driverEmployeeId   = nullableString(formData.get("driver_employee_id"));
  const driver             = nullableString(formData.get("driver"));
  const stagerEmployeeId   = nullableString(formData.get("stager_employee_id"));
  const stager             = nullableString(formData.get("stager"));

  const turfProduct      = nullableString(formData.get("turf_product"));
  const turfBatchNumber  = nullableString(formData.get("turf_batch_number"));
  const turfLinearRuns   = nullableString(formData.get("turf_linear_runs"));
  const turfTotalSqft    = nullableNumber(formData.get("turf_total_sqft"));

  const looseWarehouse    = nullableString(formData.get("loose_warehouse"));
  const looseYardDelivery = nullableString(formData.get("loose_yard_delivery"));
  const looseYardPickup   = nullableString(formData.get("loose_yard_pickup"));

  const baggedNone        = formData.get("bagged_none") === "on";
  const baggedStdSand     = numberOrZero(formData.get("bagged_standard_sand"));
  const baggedFineSand    = numberOrZero(formData.get("bagged_fine_sand"));
  const baggedWonderfill  = numberOrZero(formData.get("bagged_wonderfill"));
  const baggedMisc        = numberOrZero(formData.get("bagged_misc"));

  const nailsBoxes     = numberOrZero(formData.get("nails_boxes"));
  const staplesBoxes   = numberOrZero(formData.get("staples_boxes"));
  const glueGal        = numberOrZero(formData.get("glue_gal"));
  const seamTapeRolls  = numberOrZero(formData.get("seam_tape_rolls"));
  const weedBarrier    = nullableString(formData.get("weed_barrier"));

  const notes = nullableString(formData.get("notes"));

  // Roll rows: keys come as roll_number[] + lengths_needed[]. We accept
  // arbitrary length and skip empty roll_number entries.
  const rollNumbers = formData.getAll("roll_number").map((v) => String(v ?? "").trim());
  const lengths     = formData.getAll("lengths_needed").map((v) => String(v ?? "").trim());

  const rollsInput = rollNumbers
    .map((roll_number, i) => ({
      roll_number,
      lengths_needed: lengths[i] ?? "",
    }))
    .filter((r) => r.roll_number.length > 0);

  const sb = supabaseAdmin();

  // 1) Insert parent
  const { data: created, error: createErr } = await sb
    .from("warehouse_pull_lists")
    .insert({
      job_date:         jobDate,
      jobber_visit_id:  jobberVisitId,
      client_id:        clientId,
      client_name:      clientName,
      address,
      job_number:       jobNumber,
      crew_lead_employee_id: crewLeadEmployeeId,
      crew_lead:             crewLead,
      driver_employee_id:    driverEmployeeId,
      driver,
      stager_employee_id:    stagerEmployeeId,
      stager,
      turf_product:      turfProduct,
      turf_batch_number: turfBatchNumber,
      turf_linear_runs:  turfLinearRuns,
      turf_total_sqft:   turfTotalSqft,
      loose_warehouse:     looseWarehouse,
      loose_yard_delivery: looseYardDelivery,
      loose_yard_pickup:   looseYardPickup,
      bagged_none:           baggedNone,
      bagged_standard_sand:  baggedStdSand,
      bagged_fine_sand:      baggedFineSand,
      bagged_wonderfill:     baggedWonderfill,
      bagged_misc:           baggedMisc,
      nails_boxes:    nailsBoxes,
      staples_boxes:  staplesBoxes,
      glue_gal:       glueGal,
      seam_tape_rolls: seamTapeRolls,
      weed_barrier:    weedBarrier,
      notes,
      status: "draft",
    })
    .select("id")
    .single();
  if (createErr) throw new Error(createErr.message);
  const pullListId = (created as unknown as { id: string }).id;

  // 2) Insert roll children (if any). Roll back parent on failure.
  if (rollsInput.length > 0) {
    const rollsRows = rollsInput.map((r, i) => ({
      pull_list_id:   pullListId,
      position:       i,
      roll_number:    r.roll_number,
      lengths_needed: r.lengths_needed.length > 0 ? r.lengths_needed : null,
    }));
    const { error: rollsErr } = await sb
      .from("warehouse_pull_list_rolls")
      .insert(rollsRows);
    if (rollsErr) {
      await sb.from("warehouse_pull_lists").delete().eq("id", pullListId);
      throw new Error(`Failed to save rolls: ${rollsErr.message}`);
    }
  }

  revalidatePath("/operations/pull-lists");
  revalidatePath("/operations");
  redirect(`/operations/pull-lists/${pullListId}`);
}

// ---------------------------------------------------------------------------
// updatePullListStatus — moves a pull list through its state machine.
// Allowed: draft → pulled → staged → dispatched → delivered.
// We don't enforce the order at the DB level (the CHECK only constrains the
// enum values); doing it here gives nicer error messages.
// ---------------------------------------------------------------------------

const PULL_LIST_FLOW = ["draft", "pulled", "staged", "dispatched", "delivered"] as const;
type PullListStatusValue = (typeof PULL_LIST_FLOW)[number];

export async function updatePullListStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const next = String(formData.get("status") ?? "").trim() as PullListStatusValue;
  if (!id) throw new Error("Pull list id is required");
  if (!PULL_LIST_FLOW.includes(next)) throw new Error(`Unknown status: ${next}`);

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("warehouse_pull_lists")
    .update({ status: next })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/operations/pull-lists/${id}`);
  revalidatePath("/operations/pull-lists");
}

// ---------------------------------------------------------------------------
// signOffPullList — stager / driver / lead taps "I'm done" on their section.
// We capture name + timestamp; name comes from the current OS profile.
// ---------------------------------------------------------------------------

export async function signOffPullList(formData: FormData) {
  const id   = String(formData.get("id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  if (!id) throw new Error("Pull list id is required");
  if (!["stager", "driver", "lead"].includes(role)) {
    throw new Error(`Invalid sign-off role: ${role}`);
  }

  // Resolve current user → display name. Falls back to email or "Unknown".
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles").select("full_name, email").eq("id", user.id).single();
  const signerName =
    profile?.full_name?.trim() ||
    profile?.email?.split("@")[0] ||
    "Unknown";

  const nowIso = new Date().toISOString();
  const patch: Record<string, string> = {
    [`${role}_signed_by`]: signerName,
    [`${role}_signed_at`]: nowIso,
  };

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("warehouse_pull_lists")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/operations/pull-lists/${id}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function numberOrZero(v: FormDataEntryValue | null): number {
  if (typeof v !== "string") return 0;
  const t = v.trim();
  if (t.length === 0) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function nullableString(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function nullableNumber(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
