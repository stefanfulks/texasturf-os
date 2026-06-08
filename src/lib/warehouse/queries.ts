// Server-side read helpers for the warehouse / operations module.
//
// Reconciled with the existing OS schema:
//   - Asset rows come from public.assets (extended in B1 with make/model/year);
//     unit_type is the kind selector (truck/trailer/heavy_equipment/tool).
//   - Maintenance rows come from public.maintenance_logs (not from a
//     warehouse-specific table).
//
// All queries run with the service-role admin client; pages are server
// components so this is safe. Switch to RLS-aware client when these reads
// move to a route handler.

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  Asset,
  AssetKind,
  Budget,
  Delivery,
  Employee,
  Inspection,
  MaintenanceLog,
  PullList,
  PullListRoll,
  ToolPurchase,
} from "./types";

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export async function listEmployees(opts: { activeOnly?: boolean } = {}) {
  const sb = supabaseAdmin();
  let q = sb.from("warehouse_employees").select("*").order("display_name");
  if (opts.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Employee[];
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export async function listAssets(opts: { kind?: AssetKind; activeOnly?: boolean } = {}) {
  const sb = supabaseAdmin();
  let q = sb
    .from("assets")
    .select("id, name, unit_type, identifier, make, model, year, notes, status, created_at, updated_at")
    .order("name");
  if (opts.kind) q = q.eq("unit_type", opts.kind);
  // OS assets has no is_active flag — "out_of_service" is the dead state.
  if (opts.activeOnly) q = q.neq("status", "out_of_service");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Asset[];
}

export async function getAsset(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("assets")
    .select("id, name, unit_type, identifier, make, model, year, notes, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Asset | null;
}

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

export async function listInspections(opts: { limit?: number } = {}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_inspections")
    .select("*")
    .order("inspected_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (error) throw new Error(error.message);
  return (data ?? []) as Inspection[];
}

export async function getInspection(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_inspections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Inspection | null;
}

// ---------------------------------------------------------------------------
// Pull lists
// ---------------------------------------------------------------------------

export async function listPullLists(opts: { limit?: number } = {}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_pull_lists")
    .select("*")
    .order("job_date", { ascending: false })
    .limit(opts.limit ?? 50);
  if (error) throw new Error(error.message);
  return (data ?? []) as PullList[];
}

export async function getPullList(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_pull_lists")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as PullList | null;
}

export async function getPullListRolls(pullListId: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_pull_list_rolls")
    .select("*")
    .eq("pull_list_id", pullListId)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as PullListRoll[];
}

/**
 * List view: pull lists + their roll count + crew lead display name.
 * Optimized for the /operations/pull-lists table — one round trip with
 * embeds, not N+1.
 */
export type PullListRow = PullList & {
  warehouse_pull_list_rolls: { id: string }[];
  crew_lead_employee: { display_name: string } | null;
};

export async function listPullListsForListPage(opts: {
  status?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
} = {}) {
  const sb = supabaseAdmin();
  let q = sb
    .from("warehouse_pull_lists")
    .select(
      "*, warehouse_pull_list_rolls(id), " +
      "crew_lead_employee:warehouse_employees!warehouse_pull_lists_crew_lead_employee_id_fkey(display_name)",
    )
    .order("job_date", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.fromDate) q = q.gte("job_date", opts.fromDate);
  if (opts.toDate)   q = q.lte("job_date", opts.toDate);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PullListRow[];
}

/**
 * Picker queries — feed the form selects. All capped so the form stays snappy
 * even on a busy account. Larger sets get free-text fallback fields.
 */

export type JobberVisitOption = {
  id: string;
  title: string | null;
  starts_at: string | null;
  client_id: string | null;
  client_name: string | null;
};

export async function listJobberVisitsForPicker(opts: { days?: number } = {}) {
  const sb = supabaseAdmin();
  // Default window: last 7 days through next 30 days. Crew typically pulls for
  // visits scheduled in the upcoming week.
  const days = opts.days ?? 30;
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - 7);
  const end   = new Date(now); end.setDate(end.getDate() + days);
  const { data, error } = await sb
    .from("jobber_visits")
    .select("id, title, starts_at, client_id, client:client_id(company_name, first_name, last_name)")
    .gte("starts_at", start.toISOString())
    .lte("starts_at", end.toISOString())
    .order("starts_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    id: string;
    title: string | null;
    starts_at: string | null;
    client_id: string | null;
    client: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
  }>).map((r) => {
    const fallback = [r.client?.first_name, r.client?.last_name].filter(Boolean).join(" ");
    return {
      id:          r.id,
      title:       r.title,
      starts_at:   r.starts_at,
      client_id:   r.client_id,
      client_name: r.client?.company_name ?? (fallback.length > 0 ? fallback : null),
    };
  }) as JobberVisitOption[];
}

export type JobberClientOption = {
  id: string;
  name: string;
};

export async function listJobberClientsForPicker(opts: { query?: string; limit?: number } = {}) {
  const sb = supabaseAdmin();
  let q = sb
    .from("jobber_clients")
    .select("id, company_name, first_name, last_name")
    .eq("is_archived", false)
    .order("company_name", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 100);
  if (opts.query && opts.query.trim()) {
    const term = opts.query.trim().replace(/[%_]/g, "");
    q = q.or(
      `company_name.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`,
    );
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    id: string;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
  }>).map((r) => ({
    id:   r.id,
    name: r.company_name
      ?? [r.first_name, r.last_name].filter(Boolean).join(" ")
      ?? "(unnamed)",
  })) as JobberClientOption[];
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

export async function listDeliveries(opts: { limit?: number } = {}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_deliveries")
    .select("*")
    .order("delivered_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (error) throw new Error(error.message);
  return (data ?? []) as Delivery[];
}

/**
 * List view: deliveries + linked pull list job number and date.
 * Used by /operations/deliveries.
 */
export type DeliveryRow = Delivery & {
  pull_list: { job_number: string | null; job_date: string } | null;
};

export async function listDeliveriesForListPage(opts: { limit?: number } = {}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_deliveries")
    .select("*, pull_list:pull_list_id(job_number, job_date)")
    .order("delivered_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DeliveryRow[];
}

/**
 * Pull-list picker for the new-delivery form. Defaults to dispatched +
 * delivered states (the ones a confirmation is most likely to follow).
 */
export type PullListPickerOption = {
  id: string;
  job_date: string;
  client_name: string | null;
  job_number: string | null;
  status: string;
};

export async function listPullListsForPicker(opts: { days?: number; limit?: number } = {}) {
  const sb = supabaseAdmin();
  const days = opts.days ?? 14;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await sb
    .from("warehouse_pull_lists")
    .select("id, job_date, client_name, job_number, status")
    .gte("job_date", since.toISOString().slice(0, 10))
    .order("job_date", { ascending: false })
    .limit(opts.limit ?? 200);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PullListPickerOption[];
}

export async function getDelivery(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_deliveries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Delivery | null;
}

// ---------------------------------------------------------------------------
// Vehicle maintenance + budgets
// ---------------------------------------------------------------------------

/**
 * Vehicle maintenance log entries (powered by the existing maintenance_logs
 * table — has schedule FK and meter tracking that the variant didn't).
 */
export async function listMaintenanceLogs(opts: { assetId?: string; limit?: number } = {}) {
  const sb = supabaseAdmin();
  let q = sb
    .from("maintenance_logs")
    .select(
      "id, asset_id, schedule_id, performed_at, description, cost_cents, meter_value, " +
      "performed_by_profile, performed_by_vendor, vendor, invoice_url, notes, created_at",
    )
    .order("performed_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.assetId) q = q.eq("asset_id", opts.assetId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  // database.types.ts doesn't yet reflect the vendor / invoice_url columns
  // added in B1; cast through unknown until types are regenerated.
  return (data ?? []) as unknown as MaintenanceLog[];
}

export async function listToolPurchases(opts: { limit?: number } = {}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_tool_purchases")
    .select("*")
    .order("purchase_date", { ascending: false })
    .limit(opts.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as ToolPurchase[];
}

export async function listBudgets(opts: { kind?: "vehicle_maintenance" | "tool_purchases" } = {}) {
  const sb = supabaseAdmin();
  let q = sb.from("warehouse_budgets").select("*").order("period_start", { ascending: false });
  if (opts.kind) q = q.eq("kind", opts.kind);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Budget[];
}

// ---------------------------------------------------------------------------
// Dashboard counts for the module landing page
// ---------------------------------------------------------------------------

export async function warehouseDashboardCounts() {
  const sb = supabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  const [pullsToday, inspectionsToday, deliveriesToday, openPulls] = await Promise.all([
    sb.from("warehouse_pull_lists").select("*", { count: "exact", head: true }).eq("job_date", todayIso),
    sb
      .from("warehouse_inspections")
      .select("*", { count: "exact", head: true })
      .gte("inspected_at", today.toISOString()),
    sb
      .from("warehouse_deliveries")
      .select("*", { count: "exact", head: true })
      .gte("delivered_at", today.toISOString()),
    sb
      .from("warehouse_pull_lists")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "pulled", "staged"]),
  ]);

  return {
    pullsToday: pullsToday.count ?? 0,
    inspectionsToday: inspectionsToday.count ?? 0,
    deliveriesToday: deliveriesToday.count ?? 0,
    openPulls: openPulls.count ?? 0,
  };
}
