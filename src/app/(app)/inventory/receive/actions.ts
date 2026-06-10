"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOfficeOrAdmin } from "../_lib/require-role";
import type { InvRoll, InvProduct, InvLocation } from "@/lib/db-helpers.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Auto-generate TT SKU tag number with format yyyymmdd-NNNN.
 * NNNN is the daily sequence of rolls received that day, zero-padded to 4 digits.
 */
async function generateTagNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `${yyyy}${mm}${dd}`;

  const { data } = await supabase
    .from("inv_rolls")
    .select("tt_sku_tag_number")
    .like("tt_sku_tag_number", `${prefix}-%`)
    .order("tt_sku_tag_number", { ascending: false })
    .limit(1);

  let next = 1;
  if (data && data.length > 0) {
    const last = data[0].tt_sku_tag_number ?? "";
    const m = last.match(/-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

// ─── Quick Add Roll ───────────────────────────────────────────────────────────

const quickAddSchema = z.object({
  vendor_id:           z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  product_id:          z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  location_id:         z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  width_ft:            z.coerce.number().positive().optional(),
  original_length_ft:  z.coerce.number().positive(),
  dye_lot:             z.string().optional(),
  manufacturer_roll_number: z.string().optional(),
  tt_sku_tag_number:   z.string().optional(),
  notes:               z.string().optional(),
  pending:             z.string().optional(), // checkbox "on" / undefined
});

export type ReceiveRollState = {
  error: string | null;
  rollId: string | null;
  rollTag: string | null;
  rollProductName: string | null;
};

export async function receiveRoll(
  _prev: ReceiveRollState,
  formData: FormData,
): Promise<ReceiveRollState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  const user = auth.user;
  if (!user) return { error: auth.error, rollId: null, rollTag: null, rollProductName: null };

  const parsed = quickAddSchema.safeParse({
    vendor_id:                formData.get("vendor_id"),
    product_id:               formData.get("product_id"),
    location_id:              formData.get("location_id"),
    width_ft:                 formData.get("width_ft") || undefined,
    original_length_ft:       formData.get("original_length_ft"),
    dye_lot:                  formData.get("dye_lot") || undefined,
    manufacturer_roll_number: formData.get("manufacturer_roll_number") || undefined,
    tt_sku_tag_number:        formData.get("tt_sku_tag_number") || undefined,
    notes:                    formData.get("notes") || undefined,
    pending:                  formData.get("pending") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
      rollId: null,
      rollTag: null,
      rollProductName: null,
    };
  }

  const d = parsed.data;

  // Resolve product info if provided
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
  const tagNumber = d.tt_sku_tag_number?.trim() || (await generateTagNumber(supabase));
  const status = d.pending ? "planned" : "available";

  const { data: roll, error: insertErr } = await supabase
    .from("inv_rolls")
    .insert({
      tt_sku_tag_number:        tagNumber,
      manufacturer_roll_number: d.manufacturer_roll_number ?? null,
      vendor_id:                d.vendor_id ?? null,
      product_id:               d.product_id ?? null,
      product_name:             productName,
      dye_lot:                  d.dye_lot ?? null,
      width_ft:                 width,
      original_length_ft:       d.original_length_ft,
      current_length_ft:        d.original_length_ft,
      status,
      roll_type:                "parent",
      location_id:              d.location_id ?? null,
      notes:                    d.notes ?? null,
    })
    .select("id, tt_sku_tag_number, product_name")
    .single();

  if (insertErr || !roll) {
    return {
      error: insertErr?.message ?? "Failed to create roll",
      rollId: null,
      rollTag: null,
      rollProductName: null,
    };
  }

  await supabase.from("inv_transactions").insert({
    transaction_type: "receive",
    roll_id:          roll.id,
    from_status:      null,
    to_status:        status,
    quantity_ft:      d.original_length_ft,
    notes:            d.notes ?? null,
    created_by:       user.id,
  });

  revalidatePath("/inventory/receive");
  revalidatePath("/inventory/receive/pending");
  revalidatePath("/inventory/rolls");
  revalidatePath("/inventory");

  return {
    error: null,
    rollId: roll.id,
    rollTag: roll.tt_sku_tag_number,
    rollProductName: roll.product_name,
  };
}

// ─── Bulk Paste ───────────────────────────────────────────────────────────────

export type BulkParseRow = {
  tt_sku_tag_number?: string;
  manufacturer_roll_number?: string;
  product?: string;
  width?: string;
  length?: string;
  dye_lot?: string;
  location?: string;
  // resolved
  product_id?: string | null;
  product_name?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  errors: string[];
};

export type BulkPreviewState = {
  error: string | null;
  rows: BulkParseRow[];
  rawCsv: string;
  hasErrors: boolean;
};

const HEADERS = [
  "tt_sku",
  "manufacturer_roll",
  "product",
  "width",
  "length",
  "dye_lot",
  "location",
] as const;

function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Detect whether there's a header row. Accept either case-insensitive match
  // to HEADERS or assume positional headers if first row has 7 cells.
  const firstCells = lines[0].split(",").map((c) => c.trim().toLowerCase());
  let headers: string[];
  let dataStart: number;

  if (
    firstCells.length >= 5 &&
    firstCells.some((c) =>
      ["tt_sku", "tt_sku_tag_number", "sku", "product", "dye_lot"].includes(c),
    )
  ) {
    headers = firstCells.map((h) => {
      if (h === "tt_sku_tag_number") return "tt_sku";
      if (h === "manufacturer" || h === "mfr_roll" || h === "manufacturer_roll_number") return "manufacturer_roll";
      if (h === "width_ft") return "width";
      if (h === "length_ft") return "length";
      return h;
    });
    dataStart = 1;
  } else {
    headers = [...HEADERS];
    dataStart = 0;
  }

  const out: Array<Record<string, string>> = [];
  for (let i = dataStart; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    out.push(row);
  }
  return out;
}

export async function previewBulkPaste(
  _prev: BulkPreviewState,
  formData: FormData,
): Promise<BulkPreviewState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated", rows: [], rawCsv: "", hasErrors: true };
  }

  const csv = (formData.get("csv") as string | null) ?? "";
  if (!csv.trim()) {
    return { error: "Paste at least one row.", rows: [], rawCsv: "", hasErrors: true };
  }

  const parsed = parseCsv(csv);
  if (parsed.length === 0) {
    return { error: "No rows found in input.", rows: [], rawCsv: csv, hasErrors: true };
  }

  // Pre-fetch products + locations for lookup
  const [{ data: productsData }, { data: locationsData }] = await Promise.all([
    supabase.from("inv_products").select("id, name, width_ft").eq("active", true),
    supabase.from("inv_locations").select("id, name").eq("active", true),
  ]);

  const products = (productsData ?? []) as unknown as Pick<InvProduct, "id" | "name" | "width_ft">[];
  const locations = (locationsData ?? []) as unknown as Pick<InvLocation, "id" | "name">[];

  const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const productByName = new Map<string, Pick<InvProduct, "id" | "name" | "width_ft">>();
  for (const p of products) productByName.set(normalize(p.name), p);
  const locationByName = new Map<string, Pick<InvLocation, "id" | "name">>();
  for (const l of locations) locationByName.set(normalize(l.name), l);

  const rows: BulkParseRow[] = parsed.map((r) => {
    const errors: string[] = [];

    const productKey = normalize(r.product || "");
    const locationKey = normalize(r.location || "");
    const product = productKey ? productByName.get(productKey) : undefined;
    const location = locationKey ? locationByName.get(locationKey) : undefined;

    if (!r.length || isNaN(parseFloat(r.length)) || parseFloat(r.length) <= 0) {
      errors.push("length missing or invalid");
    }
    if (r.product && !product) {
      errors.push(`product "${r.product}" not found`);
    }
    if (r.location && !location) {
      errors.push(`location "${r.location}" not found`);
    }

    return {
      tt_sku_tag_number:        r.tt_sku || undefined,
      manufacturer_roll_number: r.manufacturer_roll || undefined,
      product:                  r.product || undefined,
      width:                    r.width || undefined,
      length:                   r.length || undefined,
      dye_lot:                  r.dye_lot || undefined,
      location:                 r.location || undefined,
      product_id:               product?.id ?? null,
      product_name:             product?.name ?? r.product ?? null,
      location_id:              location?.id ?? null,
      location_name:            location?.name ?? r.location ?? null,
      errors,
    };
  });

  return {
    error: null,
    rows,
    rawCsv: csv,
    hasErrors: rows.some((r) => r.errors.length > 0),
  };
}

export type BulkSubmitState = {
  error: string | null;
  createdCount: number;
  failedRows: number[];
};

export async function submitBulkPaste(
  _prev: BulkSubmitState,
  formData: FormData,
): Promise<BulkSubmitState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  const user = auth.user;
  if (!user) return { error: auth.error, createdCount: 0, failedRows: [] };

  const csv = (formData.get("csv") as string | null) ?? "";
  const preview = await previewBulkPaste(
    { error: null, rows: [], rawCsv: "", hasErrors: false },
    (() => { const fd = new FormData(); fd.append("csv", csv); return fd; })(),
  );

  if (preview.hasErrors) {
    return { error: "Fix the errors before importing.", createdCount: 0, failedRows: [] };
  }
  if (preview.rows.length === 0) {
    return { error: "Nothing to import.", createdCount: 0, failedRows: [] };
  }

  let created = 0;
  const failed: number[] = [];

  for (let i = 0; i < preview.rows.length; i++) {
    const r = preview.rows[i];
    const length = parseFloat(r.length || "0");
    const width = r.width ? parseFloat(r.width) : null;

    const tagNumber = r.tt_sku_tag_number?.trim() || (await generateTagNumber(supabase));

    const { data: roll, error } = await supabase
      .from("inv_rolls")
      .insert({
        tt_sku_tag_number:        tagNumber,
        manufacturer_roll_number: r.manufacturer_roll_number ?? null,
        product_id:               r.product_id ?? null,
        product_name:             r.product_name ?? null,
        dye_lot:                  r.dye_lot ?? null,
        width_ft:                 width,
        original_length_ft:       length,
        current_length_ft:        length,
        status:                   "available",
        roll_type:                "parent",
        location_id:              r.location_id ?? null,
      })
      .select("id")
      .single();

    if (error || !roll) {
      failed.push(i + 1);
      continue;
    }

    await supabase.from("inv_transactions").insert({
      transaction_type: "receive",
      roll_id:          roll.id,
      to_status:        "available",
      quantity_ft:      length,
      notes:            "Bulk paste import",
      created_by:       user.id,
    });
    created++;
  }

  revalidatePath("/inventory/receive");
  revalidatePath("/inventory/rolls");
  revalidatePath("/inventory");

  return {
    error: failed.length > 0 ? `${failed.length} row(s) failed to insert.` : null,
    createdCount: created,
    failedRows: failed,
  };
}

// ─── Pending Inventory ────────────────────────────────────────────────────────

export type ConfirmPendingState = { error: string | null; success: boolean };

export async function confirmPendingRoll(
  _prev: ConfirmPendingState,
  formData: FormData,
): Promise<ConfirmPendingState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  const user = auth.user;
  if (!user) return { error: auth.error, success: false };

  const rollId = formData.get("roll_id") as string | null;
  if (!rollId) return { error: "Missing roll id", success: false };

  // Fetch current roll
  const { data: rollData } = await supabase
    .from("inv_rolls")
    .select("id, status, current_length_ft")
    .eq("id", rollId)
    .single();

  if (!rollData) return { error: "Roll not found", success: false };
  const roll = rollData as unknown as Pick<InvRoll, "id" | "status" | "current_length_ft">;
  const prevStatus = roll.status;

  const { error: updateErr } = await supabase
    .from("inv_rolls")
    .update({ status: "available" })
    .eq("id", rollId);
  if (updateErr) return { error: updateErr.message, success: false };

  await supabase.from("inv_transactions").insert({
    transaction_type: "receive_confirm",
    roll_id:          rollId,
    from_status:      prevStatus,
    to_status:        "available",
    quantity_ft:      roll.current_length_ft,
    notes:            "Pending roll confirmed as available",
    created_by:       user.id,
  });

  revalidatePath("/inventory/receive/pending");
  revalidatePath("/inventory/rolls");
  revalidatePath("/inventory");
  return { error: null, success: true };
}

export type RejectPendingState = { error: string | null; success: boolean };

export async function rejectPendingRoll(
  _prev: RejectPendingState,
  formData: FormData,
): Promise<RejectPendingState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  const user = auth.user;
  if (!user) return { error: auth.error, success: false };

  const rollId = formData.get("roll_id") as string | null;
  const reason = (formData.get("reason") as string | null) || "Rejected on receive";
  if (!rollId) return { error: "Missing roll id", success: false };

  const { data: rollData } = await supabase
    .from("inv_rolls")
    .select("id, status, current_length_ft")
    .eq("id", rollId)
    .single();
  if (!rollData) return { error: "Roll not found", success: false };
  const roll = rollData as unknown as Pick<InvRoll, "id" | "status" | "current_length_ft">;
  const prevStatus = roll.status;

  const { error: updateErr } = await supabase
    .from("inv_rolls")
    .update({ status: "damaged", notes: reason })
    .eq("id", rollId);
  if (updateErr) return { error: updateErr.message, success: false };

  await supabase.from("inv_transactions").insert({
    transaction_type: "receive_reject",
    roll_id:          rollId,
    from_status:      prevStatus,
    to_status:        "damaged",
    quantity_ft:      roll.current_length_ft,
    notes:            reason,
    created_by:       user.id,
  });

  revalidatePath("/inventory/receive/pending");
  revalidatePath("/inventory/rolls");
  revalidatePath("/inventory");
  return { error: null, success: true };
}
