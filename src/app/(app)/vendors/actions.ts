"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const vendorSchema = z.object({
  name:          z.string().min(1, "Name is required"),
  type:          z.enum(["installer","contractor_1099","subcontractor","supplier","other"]).default("contractor_1099"),
  contact_name:  z.string().optional(),
  email:         z.string().email().optional().or(z.literal("")),
  phone:         z.string().optional(),
  address:       z.string().optional(),
  payment_terms: z.string().optional(),
  notes:         z.string().optional(),
});

export type VendorFormState = { error: string | null; success: boolean };

export async function createVendor(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = vendorSchema.safeParse({
    name:          formData.get("name"),
    type:          formData.get("type")          ?? "contractor_1099",
    contact_name:  formData.get("contact_name")  || undefined,
    email:         formData.get("email")          || undefined,
    phone:         formData.get("phone")          || undefined,
    address:       formData.get("address")        || undefined,
    payment_terms: formData.get("payment_terms")  || undefined,
    notes:         formData.get("notes")          || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { data, error } = await supabase.from("vendors").insert({
    name:          parsed.data.name,
    type:          parsed.data.type,
    contact_name:  parsed.data.contact_name  ?? null,
    email:         parsed.data.email         ?? null,
    phone:         parsed.data.phone         ?? null,
    address:       parsed.data.address       ?? null,
    payment_terms: parsed.data.payment_terms ?? null,
    notes:         parsed.data.notes         ?? null,
    created_by_id: user.id,
  }).select().single();

  if (error || !data) return { error: error?.message ?? "Failed to create vendor", success: false };

  revalidatePath("/vendors");
  redirect(`/vendors/${data.id}`);
}

export async function updateVendor(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const id = formData.get("id") as string;
  if (!id) return { error: "Vendor ID required", success: false };

  const parsed = vendorSchema.safeParse({
    name:          formData.get("name"),
    type:          formData.get("type")          ?? "contractor_1099",
    contact_name:  formData.get("contact_name")  || undefined,
    email:         formData.get("email")          || undefined,
    phone:         formData.get("phone")          || undefined,
    address:       formData.get("address")        || undefined,
    payment_terms: formData.get("payment_terms")  || undefined,
    notes:         formData.get("notes")          || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { error } = await supabase.from("vendors").update({
    ...parsed.data,
    contact_name:  parsed.data.contact_name  ?? null,
    email:         parsed.data.email         ?? null,
    phone:         parsed.data.phone         ?? null,
    address:       parsed.data.address       ?? null,
    payment_terms: parsed.data.payment_terms ?? null,
    notes:         parsed.data.notes         ?? null,
    updated_at:    new Date().toISOString(),
  }).eq("id", id);

  if (error) return { error: error.message, success: false };

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { error: null, success: true };
}

// ─── Archive / Unarchive ──────────────────────────────────────────────────────

async function requireOfficeOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated" as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin","office"].includes(profile.role)) {
    return { user, error: "Only admin and office can archive vendors" as const };
  }
  return { user, error: null as null | string };
}

export type ArchiveVendorState = { error: string | null; success: boolean };

async function setVendorActive(
  invoiceId: string,
  active: boolean,
): Promise<ArchiveVendorState> {
  const supabase = await createClient();
  const { user, error: authErr } = await requireOfficeOrAdmin(supabase);
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };

  if (!invoiceId) return { error: "Vendor ID required", success: false };

  const { error } = await supabase.from("vendors")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { error: error.message, success: false };

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${invoiceId}`);
  return { error: null, success: true };
}

export async function archiveVendor(
  _prev: ArchiveVendorState,
  formData: FormData,
): Promise<ArchiveVendorState> {
  return setVendorActive(formData.get("vendor_id") as string, false);
}

export async function unarchiveVendor(
  _prev: ArchiveVendorState,
  formData: FormData,
): Promise<ArchiveVendorState> {
  return setVendorActive(formData.get("vendor_id") as string, true);
}
