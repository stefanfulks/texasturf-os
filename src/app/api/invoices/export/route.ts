import { createClient } from "@/lib/supabase/server";
import type { Invoice, Vendor } from "@/lib/db-helpers.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Wrap a CSV field value — enclose in quotes if it contains a comma or quote */
function csvField(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "office") {
    return new Response("Forbidden", { status: 403 });
  }

  // Parse query params
  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");
  const yearParam  = url.searchParams.get("year");

  const now   = new Date();
  const year  = yearParam  ? parseInt(yearParam,  10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

  // Build query
  let query = supabase
    .from("invoices")
    .select("*, vendor:vendor_id(id, name)")
    .neq("status", "archived")
    .order("submitted_at", { ascending: false });

  // Filter by month/year if provided
  if (monthParam || yearParam) {
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 1);
    query = query
      .gte("submitted_at", startDate.toISOString())
      .lt("submitted_at",  endDate.toISOString());
  }

  const { data: invoicesRaw, error } = await query;
  if (error) {
    console.error("[invoices/export] Query error:", error.message);
    return new Response("Internal Server Error", { status: 500 });
  }

  type InvoiceWithVendor = Invoice & { vendor: Pick<Vendor, "id" | "name"> | null };
  const invoices = (invoicesRaw ?? []) as unknown as InvoiceWithVendor[];

  // Build CSV
  const headers = [
    "Title",
    "Invoice #",
    "Vendor",
    "Status",
    "Amount",
    "Submitted Date",
    "Approved Date",
    "Paid Date",
    "Service Start",
    "Service End",
    "Job #",
    "Notes",
  ];

  const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "2-digit",
        day:   "2-digit",
        year:  "numeric",
      });
    } catch {
      return iso;
    }
  };

  const rows: string[] = [headers.map(csvField).join(",")];

  for (const inv of invoices) {
    const row = [
      csvField(inv.title),
      csvField(inv.invoice_number),
      csvField(inv.vendor?.name),
      csvField(inv.status),
      csvField(inv.total_amount),
      csvField(formatDate(inv.submitted_at)),
      csvField(formatDate(inv.approved_at)),
      csvField(formatDate(inv.paid_at)),
      csvField(inv.service_period_start),
      csvField(inv.service_period_end),
      csvField(inv.job_name),
      csvField(inv.admin_notes),
    ];
    rows.push(row.join(","));
  }

  const csv = rows.join("\r\n");

  const paddedMonth = String(month).padStart(2, "0");
  const filename = `invoices-${year}-${paddedMonth}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
