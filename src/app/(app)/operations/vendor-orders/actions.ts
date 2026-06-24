"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { STAGE_ORDER } from "./_lib/status";
import type { PoStatus, PoPaymentStatus, PoDocument, PurchaseOrder, PurchaseOrderUpdate } from "@/lib/db-helpers.types";

export type FormState = { error: string | null; success: boolean };

// ── helpers ──────────────────────────────────────────────────────────────────
function rank(s: PoStatus): number {
  return STAGE_ORDER.indexOf(s);
}
function txt(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
function num(fd: FormData, k: string): number | null {
  const t = txt(fd, k);
  if (t == null) return null;
  const n = Number(t.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function dateStr(fd: FormData, k: string): string | null {
  const t = txt(fd, k);
  return t ? t.slice(0, 10) : null;
}
function bool(fd: FormData, k: string): boolean {
  return fd.get(k) != null;
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function wasEmpty(v: unknown): boolean {
  return v == null || v === "";
}

async function requireOfficeOrAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not authenticated" as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "office"].includes(profile.role)) {
    return { supabase, user, error: "Only office or admin can manage purchase orders" as const };
  }
  return { supabase, user, error: null as string | null };
}

async function logEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    purchase_order_id: string;
    event_type?: string;
    previous_status?: PoStatus | null;
    new_status?: PoStatus | null;
    changed_by_id?: string | null;
    notes?: string | null;
  },
) {
  await supabase.from("purchase_order_events").insert({
    purchase_order_id: args.purchase_order_id,
    event_type:        args.event_type ?? "status_change",
    source:            "app",
    previous_status:   args.previous_status ?? null,
    new_status:        args.new_status ?? null,
    changed_by_id:     args.changed_by_id ?? null,
    notes:             args.notes ?? null,
  });
}

// ── Create (intake form) ─────────────────────────────────────────────────────
const createSchema = z.object({
  request_description: z.string().min(1, "Description is required"),
  requested_by:        z.string().min(1, "Requested by is required"),
  priority:            z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assigned_buyer_id:   z.string().uuid("Assigned buyer is required"),
  purchase_type:       z.enum(["inventory_replenishment", "project_specific"]).default("inventory_replenishment"),
  material_needed:     z.string().optional(),
  quantity_needed:     z.string().optional(),
  needed_by:           z.string().optional(),
  project_id:          z.string().uuid().optional().or(z.literal("")),
  job_name:            z.string().optional(),
  notes:               z.string().optional(),
});

export async function createPurchaseOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = createSchema.safeParse({
    request_description: fd.get("request_description"),
    requested_by:        fd.get("requested_by"),
    priority:            fd.get("priority") ?? "normal",
    assigned_buyer_id:   fd.get("assigned_buyer_id"),
    purchase_type:       fd.get("purchase_type") ?? "inventory_replenishment",
    material_needed:     fd.get("material_needed") || undefined,
    quantity_needed:     fd.get("quantity_needed") || undefined,
    needed_by:           fd.get("needed_by") || undefined,
    project_id:          fd.get("project_id") || undefined,
    job_name:            fd.get("job_name") || undefined,
    notes:               fd.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }
  const p = parsed.data;

  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({
      status:              "new_request",
      request_description: p.request_description,
      requested_by:        p.requested_by,
      requested_by_id:     user.id,
      priority:            p.priority,
      assigned_buyer_id:   p.assigned_buyer_id,
      purchase_type:       p.purchase_type,
      material_needed:     p.material_needed ?? null,
      quantity_needed:     p.quantity_needed ?? null,
      needed_by:           p.needed_by ? p.needed_by.slice(0, 10) : null,
      project_id:          p.project_id ? p.project_id : null,
      job_name:            p.job_name ?? null,
      notes:               p.notes ?? null,
      created_by_id:       user.id,
    })
    .select()
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create request", success: false };

  await logEvent(supabase, {
    purchase_order_id: data.id,
    new_status:        "new_request",
    changed_by_id:     user.id,
    notes:             "Request created",
  });

  revalidatePath("/operations/vendor-orders");
  redirect(`/operations/vendor-orders/${data.id}`);
}

// ── Update (detail page, office/admin) ───────────────────────────────────────
/** Derive payment status from due date + remaining balance. */
function derivePaymentStatus(
  remaining: number | null,
  dueDate: string | null,
  current: PoPaymentStatus,
): PoPaymentStatus {
  if (remaining != null && remaining <= 0) return "paid";
  if (!dueDate) return current === "paid" ? "not_due" : current;
  const due = new Date(dueDate.slice(0, 10) + "T00:00:00");
  const today = new Date(todayISO() + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "past_due";
  if (days <= 7) return "due_soon";
  return "not_due";
}

export async function updatePurchaseOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user, error: authErr } = await requireOfficeOrAdmin();
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };

  const id = fd.get("id");
  if (typeof id !== "string" || !id) return { error: "Order id required", success: false };

  const { data: current } = await supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle();
  if (!current) return { error: "Order not found", success: false };
  const cur = current as PurchaseOrder;

  const description = txt(fd, "request_description");
  if (!description) return { error: "Description cannot be empty", success: false };

  // Build the new field values from the form.
  const po_number      = txt(fd, "po_number");
  const tracking       = txt(fd, "tracking_number");
  const actualDelivery = dateStr(fd, "actual_delivery_date");
  const remaining      = num(fd, "remaining_balance");

  const updates: Record<string, unknown> = {
    // Request
    assigned_buyer_id:   txt(fd, "assigned_buyer_id"),
    requested_by:        txt(fd, "requested_by"),
    priority:            txt(fd, "priority") ?? cur.priority,
    request_date:        dateStr(fd, "request_date") ?? cur.request_date,
    needed_by:           dateStr(fd, "needed_by"),
    purchase_type:       txt(fd, "purchase_type") ?? cur.purchase_type,
    project_id:          txt(fd, "project_id"),
    job_name:            txt(fd, "job_name"),
    request_description: description,
    material_needed:     txt(fd, "material_needed"),
    quantity_needed:     txt(fd, "quantity_needed"),
    notes:               txt(fd, "notes"),
    // Vendor
    vendor_id:           txt(fd, "vendor_id"),
    vendor_contact:      txt(fd, "vendor_contact"),
    quote_amount:        num(fd, "quote_amount"),
    estimated_cost:      num(fd, "estimated_cost"),
    final_order_amount:  num(fd, "final_order_amount"),
    po_number,
    order_date:          dateStr(fd, "order_date"),
    // Shipping
    carrier:             txt(fd, "carrier"),
    tracking_number:     tracking,
    tracking_url:        txt(fd, "tracking_url"),
    eta:                 dateStr(fd, "eta"),
    expected_delivery_date: dateStr(fd, "expected_delivery_date"),
    actual_delivery_date: actualDelivery,
    // Receiving
    received_by:         txt(fd, "received_by"),
    quantity_received:   txt(fd, "quantity_received"),
    shortages_reported:  bool(fd, "shortages_reported"),
    shortage_notes:      txt(fd, "shortage_notes"),
    damage_reported:     bool(fd, "damage_reported"),
    damage_notes:        txt(fd, "damage_notes"),
    // Payment
    payment_terms:       txt(fd, "payment_terms"),
    deposit_required:    bool(fd, "deposit_required"),
    deposit_amount:      num(fd, "deposit_amount"),
    deposit_paid_date:   dateStr(fd, "deposit_paid_date"),
    remaining_balance:   remaining,
    invoice_date:        dateStr(fd, "invoice_date"),
    payment_due_date:    dateStr(fd, "payment_due_date"),
    updated_at:          new Date().toISOString(),
  };

  // ── Lifecycle automations (only ever advance forward) ──────────────────────
  let status: PoStatus = cur.status;
  const advanceTo = (s: PoStatus) => { if (rank(s) > rank(status)) status = s; };
  const autoNotes: string[] = [];

  if (wasEmpty(cur.po_number) && po_number) {
    advanceTo("order_placed");
    if (!updates.order_date) updates.order_date = todayISO();
    autoNotes.push("PO# entered → Order Placed");
  }
  if (wasEmpty(cur.tracking_number) && tracking) {
    advanceTo("in_transit");
    autoNotes.push("Tracking# entered → In Transit");
  }
  if (wasEmpty(cur.actual_delivery_date) && actualDelivery) {
    advanceTo("delivered");
    autoNotes.push("Delivery date entered → Delivered");
  }
  if (remaining != null && remaining <= 0 && !(cur.remaining_balance != null && cur.remaining_balance <= 0)) {
    advanceTo("closed");
    autoNotes.push("Balance $0 → Closed");
  }

  // Derive payment status (auto field — not user-editable).
  updates.payment_status = derivePaymentStatus(remaining, updates.payment_due_date as string | null, cur.payment_status);

  const statusChanged = status !== cur.status;
  if (statusChanged) {
    updates.status = status;
    updates.status_changed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update(updates as unknown as PurchaseOrderUpdate)
    .eq("id", id);
  if (error) return { error: error.message, success: false };

  if (statusChanged) {
    await logEvent(supabase, {
      purchase_order_id: id,
      previous_status:   cur.status,
      new_status:        status,
      changed_by_id:     user.id,
      notes:             autoNotes.join("; ") || "Status updated",
    });
  }

  revalidatePath("/operations/vendor-orders");
  revalidatePath(`/operations/vendor-orders/${id}`);
  return { error: null, success: true };
}

// ── Documents (upload / remove) ──────────────────────────────────────────────
const DOC_CATEGORIES = ["quote", "po", "invoice", "shipping", "photo", "other"];

export async function uploadDocuments(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, error: authErr } = await requireOfficeOrAdmin();
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };

  const id = fd.get("id");
  if (typeof id !== "string" || !id) return { error: "Order id required", success: false };

  const categoryRaw = txt(fd, "category") ?? "other";
  const category = DOC_CATEGORIES.includes(categoryRaw) ? categoryRaw : "other";

  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "No file selected", success: false };

  const service = createServiceClient();
  const { data: cur } = await service.from("purchase_orders").select("documents").eq("id", id).maybeSingle();
  const docs: PoDocument[] = Array.isArray(cur?.documents) ? (cur!.documents as unknown as PoDocument[]) : [];

  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${id}/${Date.now()}-${safeName}`;
    const buf = await file.arrayBuffer();
    const { error: upErr } = await service.storage
      .from("purchase-orders")
      .upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) return { error: `Upload failed: ${upErr.message}`, success: false };
    docs.push({ path, name: file.name, type: file.type, size: file.size, category });
  }

  await service.from("purchase_orders")
    .update({ documents: docs as unknown as PoDocument[], updated_at: new Date().toISOString() })
    .eq("id", id);
  await service.from("purchase_order_events").insert({
    purchase_order_id: id,
    event_type: "field_update",
    source: "app",
    changed_by_id: user.id,
    notes: `Uploaded ${files.length} document${files.length > 1 ? "s" : ""} (${category})`,
  });

  revalidatePath(`/operations/vendor-orders/${id}`);
  return { error: null, success: true };
}

export async function removeDocument(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, error: authErr } = await requireOfficeOrAdmin();
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };

  const id = fd.get("id");
  const path = fd.get("path");
  if (typeof id !== "string" || !id) return { error: "Order id required", success: false };
  if (typeof path !== "string" || !path) return { error: "Document path required", success: false };

  const service = createServiceClient();
  const { data: cur } = await service.from("purchase_orders").select("documents").eq("id", id).maybeSingle();
  const docs: PoDocument[] = Array.isArray(cur?.documents) ? (cur!.documents as unknown as PoDocument[]) : [];
  const next = docs.filter((d) => d.path !== path);

  await service.storage.from("purchase-orders").remove([path]);
  await service.from("purchase_orders")
    .update({ documents: next as unknown as PoDocument[], updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(`/operations/vendor-orders/${id}`);
  return { error: null, success: true };
}

// ── Manual status change ─────────────────────────────────────────────────────
export async function setStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user, error: authErr } = await requireOfficeOrAdmin();
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };

  const id = fd.get("id");
  const next = fd.get("status");
  if (typeof id !== "string" || !id) return { error: "Order id required", success: false };
  if (typeof next !== "string" || !STAGE_ORDER.includes(next as PoStatus)) {
    return { error: "Invalid status", success: false };
  }
  const newStatus = next as PoStatus;

  const { data: current } = await supabase.from("purchase_orders").select("status").eq("id", id).maybeSingle();
  if (!current) return { error: "Order not found", success: false };
  if (current.status === newStatus) return { error: null, success: true };

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: newStatus, status_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message, success: false };

  await logEvent(supabase, {
    purchase_order_id: id,
    previous_status:   current.status as PoStatus,
    new_status:        newStatus,
    changed_by_id:     user.id,
    notes:             "Status changed manually",
  });

  revalidatePath("/operations/vendor-orders");
  revalidatePath(`/operations/vendor-orders/${id}`);
  return { error: null, success: true };
}
