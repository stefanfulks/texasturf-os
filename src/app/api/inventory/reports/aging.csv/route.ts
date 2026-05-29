import { createClient } from "@/lib/supabase/server";
import type { InvRoll, InvProduct, InvLocation } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvField(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function bucketLabel(days: number): string {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  if (days <= 180) return "91-180";
  return "180+";
}

export async function GET(): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "office") {
    return new Response("Forbidden", { status: 403 });
  }

  const { data: rollsRaw, error } = await supabase
    .from("inv_rolls")
    .select("*")
    .eq("status", "available")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[reports/aging.csv] Query error:", error.message);
    return new Response("Internal Server Error", { status: 500 });
  }

  const rolls = (rollsRaw ?? []) as InvRoll[];

  const productIds = [...new Set(rolls.map((r) => r.product_id).filter(Boolean) as string[])];
  const locationIds = [...new Set(rolls.map((r) => r.location_id).filter(Boolean) as string[])];

  const [productsRes, locationsRes] = await Promise.all([
    productIds.length > 0
      ? supabase.from("inv_products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] }),
    locationIds.length > 0
      ? supabase.from("inv_locations").select("id, name").in("id", locationIds)
      : Promise.resolve({ data: [] }),
  ]);

  const productMap = new Map<string, string>();
  for (const p of (productsRes.data ?? []) as unknown as Pick<InvProduct, "id" | "name">[]) {
    productMap.set(p.id, p.name);
  }
  const locationMap = new Map<string, string>();
  for (const l of (locationsRes.data ?? []) as unknown as Pick<InvLocation, "id" | "name">[]) {
    locationMap.set(l.id, l.name);
  }

  const headers = [
    "TT SKU",
    "Product",
    "Width (ft)",
    "Length (ft)",
    "Location",
    "Received",
    "Days in Stock",
    "Bucket",
    "Status",
    "Dye Lot",
    "Notes",
  ];

  const rows: string[] = [headers.map(csvField).join(",")];

  for (const roll of rolls) {
    const days = daysSince(roll.created_at);
    const productName = roll.product_id
      ? productMap.get(roll.product_id) ?? roll.product_name ?? ""
      : roll.product_name ?? "";
    const locationName = roll.location_id ? locationMap.get(roll.location_id) ?? "" : "";

    const row = [
      csvField(roll.tt_sku_tag_number),
      csvField(productName),
      csvField(roll.width_ft),
      csvField(roll.current_length_ft),
      csvField(locationName),
      csvField(new Date(roll.created_at).toISOString().slice(0, 10)),
      csvField(days),
      csvField(bucketLabel(days)),
      csvField(roll.status),
      csvField(roll.dye_lot),
      csvField(roll.notes),
    ];
    rows.push(row.join(","));
  }

  const csv = rows.join("\r\n");
  const filename = `aging-report-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
