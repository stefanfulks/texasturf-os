"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  NEXT_STATUS,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/turfcasa/constants";

export type OrderFormState = { error: string | null; success: boolean };

const lineSchema = z.object({
  product_id: z.string().uuid().nullable(),
  name:       z.string().min(1),
  qty:        z.coerce.number().positive(),
  unit:       z.string().min(1),
  unit_price: z.coerce.number().nullable(),
});

const orderSchema = z.object({
  source:         z.enum(["phone", "walk_in", "website"]).default("phone"),
  fulfillment:    z.enum(["will_call", "delivery"]).default("will_call"),
  customer_name:  z.string().min(1, "Customer name is required"),
  customer_email: z.string().email().optional().or(z.literal("")),
  customer_phone: z.string().optional(),
  company:        z.string().optional(),
  is_trade:       z.boolean().default(false),
  delivery_address: z.string().optional(),
  requested_date: z.string().optional(),
  notes:          z.string().optional(),
  lines:          z.array(lineSchema).min(1, "Add at least one line item"),
});

/** Manual order entry (phone / walk-in). Website orders come in through
 * /api/turfcasa/orders instead. */
export async function createOrder(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  let rawLines: unknown;
  try {
    rawLines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Line items are malformed", success: false };
  }

  const parsed = orderSchema.safeParse({
    source:           formData.get("source") ?? "phone",
    fulfillment:      formData.get("fulfillment") ?? "will_call",
    customer_name:    formData.get("customer_name"),
    customer_email:   formData.get("customer_email") || undefined,
    customer_phone:   formData.get("customer_phone") || undefined,
    company:          formData.get("company") || undefined,
    is_trade:         formData.get("is_trade") === "on",
    delivery_address: formData.get("delivery_address") || undefined,
    requested_date:   formData.get("requested_date") || undefined,
    notes:            formData.get("notes") || undefined,
    lines:            rawLines,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((e) => e.message).join(", "),
      success: false,
    };
  }

  const d = parsed.data;
  const subtotal = d.lines.reduce(
    (sum, l) => sum + (l.unit_price ?? 0) * l.qty,
    0,
  );

  const { data: order, error } = await supabase
    .from("turfcasa_orders")
    .insert({
      source:           d.source,
      fulfillment:      d.fulfillment,
      customer_name:    d.customer_name,
      customer_email:   d.customer_email || null,
      customer_phone:   d.customer_phone ?? null,
      company:          d.company ?? null,
      is_trade:         d.is_trade,
      delivery_address: d.delivery_address ?? null,
      requested_date:   d.requested_date || null,
      notes:            d.notes ?? null,
      subtotal:         subtotal || null,
      total:            subtotal || null,
      created_by:       user.id,
    })
    .select("id")
    .single();
  if (error || !order) {
    return { error: error?.message ?? "Failed to create order", success: false };
  }

  const { error: linesError } = await supabase.from("turfcasa_order_lines").insert(
    d.lines.map((l, i) => ({
      order_id:   order.id,
      product_id: l.product_id,
      name:       l.name,
      qty:        l.qty,
      unit:       l.unit,
      unit_price: l.unit_price,
      sort_order: i,
    })),
  );
  if (linesError) return { error: linesError.message, success: false };

  await supabase.from("turfcasa_order_events").insert({
    order_id: order.id,
    event:    "created",
    to_status: "new",
    actor:    user.id,
  });

  revalidatePath("/turfcasa/orders");
  revalidatePath("/turfcasa");
  redirect(`/turfcasa/orders/${order.id}`);
}

/** Warehouse status updates. Only the forward step or a cancel is allowed —
 * mirrors NEXT_STATUS so the audit trail stays a clean story. */
export async function updateOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (!ORDER_STATUSES.includes(toStatus)) return { error: "Invalid status" };

  const { data: order } = await supabase
    .from("turfcasa_orders")
    .select("status")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found" };

  const from = order.status as OrderStatus;
  const allowed =
    NEXT_STATUS[from] === toStatus ||
    (toStatus === "cancelled" && from !== "fulfilled" && from !== "cancelled");
  if (!allowed) {
    return { error: `Can't move an order from ${from} to ${toStatus}` };
  }

  const { error } = await supabase
    .from("turfcasa_orders")
    .update({ status: toStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { error: error.message };

  await supabase.from("turfcasa_order_events").insert({
    order_id:    orderId,
    event:       "status_changed",
    from_status: from,
    to_status:   toStatus,
    actor:       user.id,
  });

  revalidatePath("/turfcasa/orders");
  revalidatePath(`/turfcasa/orders/${orderId}`);
  revalidatePath("/turfcasa");
  return { error: null };
}

/** Warehouse note on the order's trail ("customer called, pickup Friday"). */
export async function addOrderNote(
  orderId: string,
  note: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const trimmed = note.trim();
  if (!trimmed) return { error: "Note is empty" };

  const { error } = await supabase.from("turfcasa_order_events").insert({
    order_id: orderId,
    event:    "note",
    note:     trimmed,
    actor:    user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/turfcasa/orders/${orderId}`);
  return { error: null };
}

/** Link the Jobber invoice that bills this order (Jobber stays the system of
 * record for money; we only keep the pointer). */
export async function setJobberInvoice(
  orderId: string,
  invoiceNumber: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("turfcasa_orders")
    .update({
      jobber_invoice_number: invoiceNumber.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath(`/turfcasa/orders/${orderId}`);
  return { error: null };
}
