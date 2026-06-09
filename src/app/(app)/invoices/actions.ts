"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendInvoiceNotification } from "@/lib/integrations/slack";
import { createMondayItem, updateMondayItem } from "@/lib/integrations/monday";
import { sendInvoiceEmail } from "@/lib/integrations/email";
import type { Invoice, InvoiceStatus } from "@/lib/database.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logSync(
  supabase: Awaited<ReturnType<typeof createClient>>,
  provider: string,
  entityId: string,
  status: "success" | "failed" | "skipped",
  externalId?: string,
  message?: string,
) {
  await supabase.from("integration_sync_logs").insert({
    provider,
    local_entity_type: "invoice",
    local_entity_id:   entityId,
    external_entity_id: externalId ?? null,
    status,
    message: message ?? null,
  });
}

async function recordStatusChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
  previousStatus: InvoiceStatus | null,
  newStatus: InvoiceStatus,
  changedById: string,
  notes?: string,
) {
  await supabase.from("invoice_status_history").insert({
    invoice_id:      invoiceId,
    previous_status: previousStatus,
    new_status:      newStatus,
    changed_by_id:   changedById,
    notes:           notes ?? null,
  });
}

async function notifyAll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoice: Invoice & { vendorName?: string },
  event: string,
  submitterEmail?: string,
) {
  // Slack
  const slackRes = await sendInvoiceNotification(invoice, event);
  await logSync(supabase, "slack", invoice.id, slackRes.success ? "success" : "failed", slackRes.externalId, slackRes.message ?? slackRes.error);

  // Monday
  if (invoice.monday_item_id) {
    const mondayRes = await updateMondayItem(invoice.monday_item_id, invoice);
    await logSync(supabase, "monday", invoice.id, mondayRes.success ? "success" : "failed", undefined, mondayRes.message ?? mondayRes.error);
  }

  // Email to submitter on certain events
  if (submitterEmail && ["approved", "request_change", "paid", "rejected"].includes(invoice.status)) {
    const emailRes = await sendInvoiceEmail(submitterEmail, invoice);
    await logSync(supabase, "email", invoice.id, emailRes.success ? "success" : "failed", emailRes.externalId, emailRes.message ?? emailRes.error);
  }
}

// ─── Submit Invoice ────────────────────────────────────────────────────────────

const submitSchema = z.object({
  title:                z.string().min(1, "Title is required"),
  vendor_id:            z.string().uuid().optional(),
  project_id:           z.string().uuid().optional(),
  total_amount:         z.coerce.number().positive().optional(),
  service_period_start: z.string().optional(),
  service_period_end:   z.string().optional(),
  job_name:             z.string().optional(),
  customer_name:        z.string().optional(),
  original_file_url:    z.string().url().optional(),
  original_file_type:   z.string().optional(),
  original_file_name:   z.string().optional(),
  notes:                z.string().optional(),
});

export type SubmitInvoiceState = { error: string | null; invoiceId: string | null };

export async function submitInvoice(
  _prev: SubmitInvoiceState,
  formData: FormData,
): Promise<SubmitInvoiceState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", invoiceId: null };

  const parsed = submitSchema.safeParse({
    title:                formData.get("title"),
    vendor_id:            formData.get("vendor_id")            || undefined,
    project_id:           formData.get("project_id")           || undefined,
    total_amount:         formData.get("total_amount")         || undefined,
    service_period_start: formData.get("service_period_start") || undefined,
    service_period_end:   formData.get("service_period_end")   || undefined,
    job_name:             formData.get("job_name")             || undefined,
    customer_name:        formData.get("customer_name")        || undefined,
    original_file_url:    formData.get("original_file_url")    || undefined,
    original_file_type:   formData.get("original_file_type")   || undefined,
    original_file_name:   formData.get("original_file_name")   || undefined,
    notes:                formData.get("notes")                || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), invoiceId: null };
  }

  const d = parsed.data;

  // Fetch vendor name for notifications
  let vendorName: string | undefined;
  if (d.vendor_id) {
    const { data: vendor } = await supabase.from("vendors").select("name").eq("id", d.vendor_id).single();
    vendorName = vendor?.name;
  }

  // ── Duplicate detection ──────────────────────────────────────────────────────
  let duplicateWarning = false;

  // 1. Amount-based dedup: same vendor + amount within ±1% in the last 30 days
  if (d.vendor_id && d.total_amount) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const low  = d.total_amount * 0.99;
    const high = d.total_amount * 1.01;

    const { data: amountMatches } = await supabase
      .from("invoices")
      .select("id")
      .eq("vendor_id", d.vendor_id)
      .gte("total_amount", low)
      .lte("total_amount", high)
      .gte("submitted_at", thirtyDaysAgo)
      .limit(1);

    if (amountMatches && amountMatches.length > 0) {
      duplicateWarning = true;
    }
  }

  // 2. Invoice-number dedup: same invoice_number + same vendor
  if (!duplicateWarning && d.vendor_id) {
    const invoiceNumber = formData.get("invoice_number") as string | null;
    if (invoiceNumber && invoiceNumber.trim() !== "") {
      const { data: numMatches } = await supabase
        .from("invoices")
        .select("id")
        .eq("vendor_id", d.vendor_id)
        .eq("invoice_number", invoiceNumber.trim())
        .limit(1);

      if (numMatches && numMatches.length > 0) {
        duplicateWarning = true;
      }
    }
  }

  // Create invoice
  const { data: invoice, error: insertErr } = await supabase
    .from("invoices")
    .insert({
      title:                d.title,
      vendor_id:            d.vendor_id    ?? null,
      project_id:           d.project_id   ?? null,
      total_amount:         d.total_amount ?? null,
      service_period_start: d.service_period_start ?? null,
      service_period_end:   d.service_period_end   ?? null,
      job_name:             d.job_name      ?? null,
      customer_name:        d.customer_name ?? null,
      original_file_url:    d.original_file_url  ?? null,
      original_file_type:   d.original_file_type ?? null,
      original_file_name:   d.original_file_name ?? null,
      admin_notes:          d.notes ?? null,
      submitted_by_id:      user.id,
      status:               "awaiting_review",
      duplicate_warning:    duplicateWarning,
    })
    .select()
    .single();

  if (insertErr || !invoice) {
    return { error: insertErr?.message ?? "Failed to create invoice", invoiceId: null };
  }

  // Status history entry
  await recordStatusChange(supabase, invoice.id, null, invoice.status as InvoiceStatus, user.id, "Invoice submitted");

  // OCR/extraction intentionally disabled — too inaccurate. Office reviews the
  // attached file and enters fields manually. The `ocr_jobs` table, ocr_text /
  // ocr_confidence columns, and src/lib/ocr/* are left in place but unused so
  // this can be re-enabled later if extraction quality improves.

  // Fetch final invoice for notifications
  const { data: finalInvoice } = await supabase.from("invoices").select("*").eq("id", invoice.id).single();
  if (finalInvoice) {
    const enriched = { ...finalInvoice, vendorName } as Invoice & { vendorName?: string };

    // Create Monday item
    const mondayRes = await createMondayItem(enriched);
    if (mondayRes.success && mondayRes.externalId) {
      await supabase.from("invoices").update({ monday_item_id: mondayRes.externalId }).eq("id", invoice.id);
    }
    await logSync(supabase, "monday", invoice.id, mondayRes.success ? "success" : "failed", mondayRes.externalId, mondayRes.message ?? mondayRes.error);

    // Slack notification
    const slackRes = await sendInvoiceNotification(enriched, "New invoice submitted");
    await logSync(supabase, "slack", invoice.id, slackRes.success ? "success" : "failed", slackRes.externalId, slackRes.message ?? slackRes.error);
  }

  revalidatePath("/invoices");
  return { error: null, invoiceId: invoice.id };
}

// ─── Change Status ─────────────────────────────────────────────────────────────

const statusSchema = z.object({
  invoice_id:   z.string().uuid(),
  new_status:   z.enum(["awaiting_review","awaiting_approval","approved","request_change","rejected","on_hold","paid","archived"]),
  notes:        z.string().optional(),
  admin_notes:       z.string().optional(),
  variance_notes:    z.string().optional(),
  ownership_notes:   z.string().optional(),
  payment_notes:     z.string().optional(),
  payment_method:    z.string().optional(),
  payment_reference: z.string().optional(),
  change_request_reason: z.string().optional(),
});

export type ChangeStatusState = { error: string | null; success: boolean };

// Statuses that release or finalize money — gated to admin only at the
// server-action layer. RLS enforces the same rule in
// 20260609100000_invoice_approval_admin_only.sql as defense in depth.
const ADMIN_ONLY_STATUSES = new Set(["approved", "paid"]);

export async function changeInvoiceStatus(
  _prev: ChangeStatusState,
  formData: FormData,
): Promise<ChangeStatusState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = statusSchema.safeParse({
    invoice_id:   formData.get("invoice_id"),
    new_status:   formData.get("new_status"),
    notes:        formData.get("notes")             || undefined,
    admin_notes:  formData.get("admin_notes")       || undefined,
    variance_notes:    formData.get("variance_notes")    || undefined,
    ownership_notes:   formData.get("ownership_notes")   || undefined,
    payment_notes:     formData.get("payment_notes")     || undefined,
    payment_method:    formData.get("payment_method")    || undefined,
    payment_reference: formData.get("payment_reference") || undefined,
    change_request_reason: formData.get("change_request_reason") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const d = parsed.data;

  // Gate the money-releasing transitions to admin only. The approval page in
  // src/app/(app)/invoices/[id]/approval/page.tsx already checks this at the
  // UI layer, but that check is bypassable by a direct POST to this action.
  if (ADMIN_ONLY_STATUSES.has(d.new_status)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return { error: "Only admins can approve or mark invoices paid", success: false };
    }
  }

  // Fetch current invoice
  const { data: invoiceRaw } = await supabase
    .from("invoices")
    .select("*, vendor:vendor_id(name)")
    .eq("id", d.invoice_id)
    .single();

  if (!invoiceRaw) return { error: "Invoice not found", success: false };
  const invoice = invoiceRaw as unknown as Invoice & { vendor: { name: string } | null };

  const prevStatus = invoice.status as InvoiceStatus;

  // Build update payload — cast to satisfy Supabase's strict update types
  type InvoiceUpdatePayload = import("@/lib/database.types").InvoiceUpdate;
  const updates: InvoiceUpdatePayload = {
    status:            d.new_status as InvoiceStatus,
    status_changed_at: new Date().toISOString(),
    ...(d.new_status === "awaiting_review"   && { reviewed_by_id: user.id }),
    ...(d.new_status === "awaiting_approval" && { reviewed_at: new Date().toISOString(), reviewed_by_id: user.id }),
    ...(d.new_status === "approved"          && { approved_at: new Date().toISOString(), approved_by_id: user.id }),
    ...(d.new_status === "paid"              && { paid_at: new Date().toISOString(), paid_by_id: user.id }),
    ...(d.admin_notes           && { admin_notes: d.admin_notes }),
    ...(d.variance_notes        && { variance_notes: d.variance_notes }),
    ...(d.ownership_notes       && { ownership_notes: d.ownership_notes }),
    ...(d.payment_notes         && { payment_notes: d.payment_notes }),
    ...(d.payment_method        && { payment_method: d.payment_method }),
    ...(d.payment_reference     && { payment_reference: d.payment_reference }),
    ...(d.change_request_reason && { change_request_reason: d.change_request_reason }),
  };

  const { error: updateErr } = await supabase.from("invoices").update(updates).eq("id", d.invoice_id);
  if (updateErr) return { error: updateErr.message, success: false };

  await recordStatusChange(supabase, d.invoice_id, prevStatus, d.new_status as InvoiceStatus, user.id, d.notes);

  // Re-fetch with updates for notifications
  const { data: updatedInvoice } = await supabase.from("invoices").select("*").eq("id", d.invoice_id).single();
  if (updatedInvoice) {
    const enriched  = { ...(updatedInvoice as unknown as Invoice), vendorName: invoice.vendor?.name } as Invoice & { vendorName?: string };
    const event     = STATUS_EVENTS[d.new_status] ?? `Status changed to ${d.new_status}`;

    // Fetch submitter email for certain statuses
    let submitterEmail: string | undefined;
    if (["approved","request_change","paid","rejected"].includes(d.new_status)) {
      const { data: submitter } = await supabase.from("profiles").select("email").eq("id", (invoice as Invoice).submitted_by_id).single();
      submitterEmail = submitter?.email;
    }

    await notifyAll(supabase, enriched, event, submitterEmail);
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${d.invoice_id}`);
  return { error: null, success: true };
}

const STATUS_EVENTS: Partial<Record<string, string>> = {
  awaiting_review:   "Invoice sent to office review",
  awaiting_approval: "Invoice ready for ownership approval",
  approved:          "Invoice approved by ownership",
  request_change:    "Changes requested on invoice",
  rejected:          "Invoice rejected",
  on_hold:           "Invoice placed on hold",
  paid:              "Invoice marked paid",
};

// ─── Update Invoice Fields (office edit) ──────────────────────────────────────

export type UpdateInvoiceFieldsState = { error: string | null; success: boolean };

export async function updateInvoiceFields(
  _prev: UpdateInvoiceFieldsState,
  formData: FormData,
): Promise<UpdateInvoiceFieldsState> {
  const supabase = await createClient();
  const { user, error: authErr } = await requireOfficeOrAdmin(supabase);
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };

  const id = formData.get("invoice_id") as string;
  if (!id) return { error: "Invoice ID required", success: false };

  // Fetch current row so we can (a) gate edits to closed invoices and
  // (b) compute a money-fields diff for the audit comment.
  const { data: currentRaw } = await supabase
    .from("invoices")
    .select("status, subtotal, tax, total_amount, vendor_id")
    .eq("id", id)
    .single();
  if (!currentRaw) return { error: "Invoice not found", success: false };
  const current = currentRaw as unknown as {
    status: string;
    subtotal: number | null;
    tax: number | null;
    total_amount: number | null;
    vendor_id: string | null;
  };

  // Once an invoice is approved or paid, only admin can amend it. Otherwise
  // office could quietly change total_amount on a released invoice.
  if (["approved", "paid"].includes(current.status)) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return { error: "Only admins can edit approved or paid invoices", success: false };
    }
  }

  // Build explicit typed payload to satisfy Supabase strict types
  const getStr = (key: string) => { const v = formData.get(key); return v === null ? undefined : (v === "" ? null : String(v)); };
  const getNum = (key: string) => { const v = formData.get(key); return v === null || v === "" ? undefined : Number(v); };

  const payload = {
    updated_at:           new Date().toISOString(),
    title:                getStr("title") ?? undefined,
    vendor_id:            getStr("vendor_id"),
    project_id:           getStr("project_id"),
    invoice_number:       getStr("invoice_number"),
    invoice_date:         getStr("invoice_date"),
    service_period_start: getStr("service_period_start"),
    service_period_end:   getStr("service_period_end"),
    subtotal:             getNum("subtotal"),
    tax:                  getNum("tax"),
    total_amount:         getNum("total_amount"),
    job_name:             getStr("job_name"),
    customer_name:        getStr("customer_name"),
    admin_notes:          getStr("admin_notes"),
    variance_notes:       getStr("variance_notes"),
    approval_deadline:    getStr("approval_deadline"),
  } satisfies import("@/lib/database.types").InvoiceUpdate;

  const { error } = await supabase.from("invoices").update(payload).eq("id", id);
  if (error) return { error: error.message, success: false };

  // Audit any money-field change as an internal comment. Skip if nothing
  // changed (saves UI clutter).
  const changes: string[] = [];
  if (payload.subtotal     !== undefined && payload.subtotal     !== current.subtotal)     changes.push(`subtotal: ${current.subtotal ?? "—"} → ${payload.subtotal}`);
  if (payload.tax          !== undefined && payload.tax          !== current.tax)          changes.push(`tax: ${current.tax ?? "—"} → ${payload.tax}`);
  if (payload.total_amount !== undefined && payload.total_amount !== current.total_amount) changes.push(`total_amount: ${current.total_amount ?? "—"} → ${payload.total_amount}`);
  if (payload.vendor_id    !== undefined && payload.vendor_id    !== current.vendor_id)    changes.push(`vendor changed`);
  if (changes.length > 0) {
    await supabase.from("invoice_comments").insert({
      invoice_id: id,
      user_id:    user.id,
      body:       `Fields edited: ${changes.join("; ")}`,
      visibility: "internal",
    });
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { error: null, success: true };
}

// ─── Archive / Unarchive ──────────────────────────────────────────────────────

async function requireOfficeOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated" as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin","office"].includes(profile.role)) {
    return { user, error: "Only admin and office can archive invoices" as const };
  }
  return { user, error: null as null | string };
}

export type ArchiveInvoiceState = { error: string | null; success: boolean };

export async function archiveInvoice(
  _prev: ArchiveInvoiceState,
  formData: FormData,
): Promise<ArchiveInvoiceState> {
  const supabase = await createClient();
  const { user, error: authErr } = await requireOfficeOrAdmin(supabase);
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };

  const invoiceId = formData.get("invoice_id") as string;
  if (!invoiceId) return { error: "Invoice ID required", success: false };

  const { data: current } = await supabase.from("invoices").select("status").eq("id", invoiceId).single();
  if (!current) return { error: "Invoice not found", success: false };
  if (current.status === "archived") return { error: "Already archived", success: false };

  const { error } = await supabase
    .from("invoices")
    .update({
      status:            "archived" as InvoiceStatus,
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (error) return { error: error.message, success: false };

  await recordStatusChange(supabase, invoiceId, current.status as InvoiceStatus, "archived", user.id, "Invoice archived");

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null, success: true };
}

export async function unarchiveInvoice(
  _prev: ArchiveInvoiceState,
  formData: FormData,
): Promise<ArchiveInvoiceState> {
  const supabase = await createClient();
  const { user, error: authErr } = await requireOfficeOrAdmin(supabase);
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };

  const invoiceId = formData.get("invoice_id") as string;
  if (!invoiceId) return { error: "Invoice ID required", success: false };

  const { data: current } = await supabase.from("invoices").select("status").eq("id", invoiceId).single();
  if (!current) return { error: "Invoice not found", success: false };
  if (current.status !== "archived") return { error: "Invoice is not archived", success: false };

  // Look at the most recent non-archive entry in history to restore prior status
  const { data: priorEntries } = await supabase
    .from("invoice_status_history")
    .select("new_status, previous_status")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(20);

  let restoreStatus: InvoiceStatus = "awaiting_review";
  if (priorEntries) {
    const previousArchiveEntry = priorEntries.find((e) => e.new_status === "archived");
    if (previousArchiveEntry?.previous_status) {
      restoreStatus = previousArchiveEntry.previous_status as InvoiceStatus;
    }
  }

  const { error } = await supabase
    .from("invoices")
    .update({
      status:            restoreStatus,
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (error) return { error: error.message, success: false };

  await recordStatusChange(supabase, invoiceId, "archived", restoreStatus, user.id, "Invoice restored from archive");

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null, success: true };
}

// ─── Add Comment ──────────────────────────────────────────────────────────────

export type AddCommentState = { error: string | null; success: boolean };

export async function addInvoiceComment(
  _prev: AddCommentState,
  formData: FormData,
): Promise<AddCommentState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const invoiceId  = formData.get("invoice_id") as string;
  const body       = formData.get("body") as string;
  const visibility = (formData.get("visibility") as string) || "internal";

  if (!invoiceId || !body?.trim()) return { error: "Comment cannot be empty", success: false };

  const { error } = await supabase.from("invoice_comments").insert({ invoice_id: invoiceId, user_id: user.id, body: body.trim(), visibility });
  if (error) return { error: error.message, success: false };

  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null, success: true };
}

// ─── Update Line Items ────────────────────────────────────────────────────────

export type UpdateLineItemsState = { error: string | null; success: boolean };

export async function upsertLineItems(
  invoiceId: string,
  lineItems: Array<{
    id?: string;
    description: string;
    category?: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    line_total: number;
  }>,
): Promise<UpdateLineItemsState> {
  const supabase = await createClient();
  const { user, error: authErr } = await requireOfficeOrAdmin(supabase);
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };

  // Block edits to approved/paid invoices except by admin — line_total feeds
  // variance and approval, so quietly rewriting it post-approval is the
  // same money-flow risk as updateInvoiceFields.
  const { data: currentRaw } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();
  if (!currentRaw) return { error: "Invoice not found", success: false };
  if (["approved", "paid"].includes((currentRaw as { status: string }).status)) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return { error: "Only admins can edit line items on approved or paid invoices", success: false };
    }
  }

  // Audit the wholesale re-write as an internal comment before we delete.
  await supabase.from("invoice_comments").insert({
    invoice_id: invoiceId,
    user_id:    user.id,
    body:       `Line items rewritten (${lineItems.length} item${lineItems.length === 1 ? "" : "s"})`,
    visibility: "internal",
  });

  // Delete existing and re-insert
  await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);

  if (lineItems.length > 0) {
    const { error } = await supabase.from("invoice_line_items").insert(
      lineItems.map((item, i) => ({
        invoice_id:   invoiceId,
        description:  item.description,
        category:     item.category    ?? null,
        quantity:     item.quantity    ?? null,
        unit:         item.unit        ?? null,
        unit_price:   item.unit_price  ?? null,
        line_total:   item.line_total,
        sort_order:   i,
      }))
    );
    if (error) return { error: error.message, success: false };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null, success: true };
}
