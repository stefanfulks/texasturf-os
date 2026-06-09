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

/**
 * List view: maintenance log rows + their asset name + unit_type.
 * Filtered to vehicle-ish assets (truck / trailer / heavy_equipment), NOT
 * tools — tool work doesn't go in maintenance_logs.
 */
export type MaintenanceLogRow = MaintenanceLog & {
  asset: { name: string; unit_type: string } | null;
};

export async function listMaintenanceLogsForListPage(opts: { unitType?: string; limit?: number } = {}) {
  const sb = supabaseAdmin();
  let q = sb
    .from("maintenance_logs")
    .select(
      "id, asset_id, schedule_id, performed_at, description, cost_cents, meter_value, " +
      "performed_by_profile, performed_by_vendor, vendor, invoice_url, notes, created_at, " +
      "asset:asset_id(name, unit_type)",
    )
    .order("performed_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.unitType) q = q.eq("asset.unit_type", opts.unitType);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  // Filter out the rare maint log against a 'tool' asset (we're on the
  // vehicle page); also drops orphan rows whose asset got hard-deleted.
  return ((data ?? []) as unknown as MaintenanceLogRow[]).filter(
    (r) => r.asset && r.asset.unit_type !== "tool",
  );
}

/**
 * Vehicle asset picker for the maintenance form. Excludes 'tool' assets.
 */
export type VehicleAssetOption = {
  id: string;
  name: string;
  unit_type: "truck" | "trailer" | "heavy_equipment";
  identifier: string | null;
  status: string;
};

export async function listVehicleAssets() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("assets")
    .select("id, name, unit_type, identifier, status")
    .in("unit_type", ["truck", "trailer", "heavy_equipment"])
    .neq("status", "out_of_service")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as VehicleAssetOption[];
}

/**
 * Maintenance schedules picker — optional link from a log entry back to
 * the schedule that triggered it.
 */
export type MaintenanceScheduleOption = {
  id: string;
  asset_id: string;
  name: string;
  interval_type: string;
  next_due_at: string | null;
  next_due_meter: number | null;
};

export async function listMaintenanceSchedulesForAsset(assetId: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("maintenance_schedules")
    .select("id, asset_id, name, interval_type, next_due_at, next_due_meter")
    .eq("asset_id", assetId)
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MaintenanceScheduleOption[];
}

/**
 * Sum of maintenance_logs.cost_cents in a date range. Used for the
 * current-period rollup card on /operations/vehicles.
 */
export async function sumMaintenanceCostInRange(opts: {
  fromIso: string;
  toIso: string;
}): Promise<number> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("maintenance_logs")
    .select("cost_cents")
    .gte("performed_at", opts.fromIso)
    .lte("performed_at", opts.toIso);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { cost_cents: number }[]).reduce(
    (acc, r) => acc + (Number(r.cost_cents) || 0),
    0,
  );
}

/**
 * Find the warehouse_budgets row that covers `today` for the given kind.
 * Returns the most recent matching row if there are several overlapping
 * (e.g. quarterly + annual — pick the tighter one).
 */
export async function findActiveBudget(opts: {
  kind: "vehicle_maintenance" | "tool_purchases";
  todayIso: string; // YYYY-MM-DD
}) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_budgets")
    .select("id, kind, asset_id, period_start, period_end, amount_cents, notes")
    .eq("kind", opts.kind)
    .lte("period_start", opts.todayIso)
    .gte("period_end", opts.todayIso)
    .is("asset_id", null) // overall budget, not per-asset
    .order("period_start", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    id: string;
    kind: string;
    asset_id: string | null;
    period_start: string;
    period_end: string;
    amount_cents: number;
    notes: string | null;
  }>)[0] ?? null;
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

/**
 * List view: tool purchases + their optional asset name. Used by
 * /operations/tools.
 */
export type ToolPurchaseRow = ToolPurchase & {
  asset:    { name: string } | null;
  submitter: { display_name: string } | null;
};

export async function listToolPurchasesForListPage(opts: {
  category?: string;
  limit?: number;
} = {}) {
  const sb = supabaseAdmin();
  let q = sb
    .from("warehouse_tool_purchases")
    .select(
      "*, asset:asset_id(name), " +
      "submitter:submitted_by_employee_id(display_name)",
    )
    .order("purchase_date", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.category) q = q.eq("category", opts.category);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ToolPurchaseRow[];
}

/**
 * Sum of tool purchase cost in a date range. Drives the spend-vs-budget
 * card on /operations/tools.
 */
export async function sumToolPurchasesInRange(opts: {
  fromIso: string; // YYYY-MM-DD
  toIso:   string;
}): Promise<number> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("warehouse_tool_purchases")
    .select("cost_cents, quantity")
    .gte("purchase_date", opts.fromIso)
    .lte("purchase_date", opts.toIso);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { cost_cents: number; quantity: number }[]).reduce(
    (acc, r) => acc + (Number(r.cost_cents) || 0) * (Number(r.quantity) || 1),
    0,
  );
}

/**
 * Asset picker for the tool-purchase form. Includes ALL active assets
 * (trucks/trailers/heavy_equipment + tools) — sometimes a "tool purchase"
 * is the acquisition cost of a vehicle's accessory.
 */
export async function listAssetsForToolPurchase() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("assets")
    .select("id, name, unit_type")
    .neq("status", "out_of_service")
    .order("unit_type", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Array<{ id: string; name: string; unit_type: string }>;
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
