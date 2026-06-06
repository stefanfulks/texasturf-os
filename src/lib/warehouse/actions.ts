"use server";

// Server actions for warehouse mutations.
// No auth gate yet — flagged in the migration; add when Google SSO lands.

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

  revalidatePath("/warehouse/inspections");
  revalidatePath("/warehouse");
  redirect(`/warehouse/inspections/${data.id}`);
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
  const role = nullableString(formData.get("role"));
  const email = nullableString(formData.get("email"));
  const phone = nullableString(formData.get("phone"));

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("warehouse_employees")
    .insert({ first_name: firstName, last_name: lastName, role, email, phone });
  if (error) throw new Error(error.message);

  revalidatePath("/warehouse/employees");
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

  const sb = supabaseAdmin();
  const { error } = await sb.from("warehouse_assets").insert({
    kind,
    name,
    identifier: nullableString(formData.get("identifier")),
    make: nullableString(formData.get("make")),
    model: nullableString(formData.get("model")),
    year: nullableNumber(formData.get("year")),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/warehouse/assets");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
