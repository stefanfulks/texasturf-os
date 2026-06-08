// Hand-rolled types matching the warehouse_* tables created by
// supabase/migrations/20260606100000_warehouse_core.sql.
//
// Replace with `supabase gen types typescript` output once the project is linked
// and the new tables are reflected in src/lib/database.types.ts.

// EmployeeRole is the JOB role on the crew (driver, stager, etc.), distinct
// from the APP permission role on profiles (admin/office/field).
export type EmployeeRole =
  | "warehouse"
  | "driver"
  | "stager"
  | "crew_lead"
  | "installer"
  | "office"
  | "admin"
  | "contractor"
  | "other";

// Mirrors the public.unit_type enum (extended in B1 to include 'tool').
export type AssetKind = "truck" | "trailer" | "heavy_equipment" | "tool";

export type PullListStatus =
  | "draft"
  | "pulled"
  | "staged"
  | "dispatched"
  | "delivered";

export type InspectionResult = "pass" | "fail";

export type ToolCategory = "tool" | "small_equipment" | "supply";

export type BudgetKind = "vehicle_maintenance" | "tool_purchases";

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface Employee {
  id: string;
  /** Optional link to the OS user (profiles.id) if this person has a login. */
  profile_id: string | null;
  first_name: string;
  last_name: string | null;
  display_name: string; // generated column
  /** Job role (driver / stager / etc.) — NOT the app permission role. */
  job_role: EmployeeRole | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Asset shape for the warehouse module.
 *
 * Maps to the *existing* `public.assets` table (extended in B1 with
 * identifier/make/model/year). Trucks, trailers, heavy equipment, AND now
 * tools all live in one table — `unit_type` is the kind selector.
 */
export type AssetStatus =
  | "available"
  | "assigned_to_job"
  | "in_use_today"
  | "maintenance_needed"
  | "out_of_service";

export interface Asset {
  id: string;
  name: string;
  unit_type: AssetKind;
  /** Active life-cycle status. "out_of_service" is the dead/retired state. */
  status: AssetStatus;
  identifier: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PullList {
  id: string;
  job_date: string; // date
  jobber_visit_id: string | null;
  client_id: string | null;
  /** Optional FK to the inv_allocations ledger row that backs this pull list. */
  inv_allocation_id: string | null;
  client_name: string | null;
  address: string | null;
  job_number: string | null;
  crew_lead_employee_id: string | null;
  crew_lead: string | null;
  driver_employee_id: string | null;
  driver: string | null;
  stager_employee_id: string | null;
  stager: string | null;
  turf_product: string | null;
  turf_batch_number: string | null;
  turf_linear_runs: string | null;
  turf_total_sqft: string | null; // numeric → string from supabase-js
  loose_warehouse: string | null;
  loose_yard_delivery: string | null;
  loose_yard_pickup: string | null;
  bagged_none: boolean;
  bagged_standard_sand: number;
  bagged_fine_sand: number;
  bagged_wonderfill: number;
  bagged_misc: number;
  nails_boxes: number;
  staples_boxes: number;
  glue_gal: number;
  seam_tape_rolls: number;
  weed_barrier: string | null;
  stager_signed_by: string | null;
  stager_signed_at: string | null;
  driver_signed_by: string | null;
  driver_signed_at: string | null;
  lead_signed_by: string | null;
  lead_signed_at: string | null;
  status: PullListStatus;
  notes: string | null;
  /** UUID FK to profiles.id (the OS user who drafted the pull list). */
  created_by_profile: string | null;
  created_at: string;
  updated_at: string;
}

export interface PullListRoll {
  id: string;
  pull_list_id: string;
  /** Optional FK to inv_rolls.id — populated when the row is tied to a tracked roll. */
  inv_roll_id: string | null;
  position: number;
  roll_number: string;
  lengths_needed: string | null;
  created_at: string;
}

export interface InspectionItems {
  trailer: {
    tires: boolean | null;
    lights: boolean | null;
    hitch: boolean | null;
    chains: boolean | null;
    dump: boolean | null;
    ramps: boolean | null;
  };
  truck: {
    fuel: boolean | null;
    oil: boolean | null;
    tire_pressure: boolean | null;
    brakes: boolean | null;
    mirrors: boolean | null;
  };
  heavy_equipment: {
    secured: boolean | null;
    ramps_stowed: boolean | null;
    fuel: boolean | null;
    no_leaks: boolean | null;
  };
  tools: {
    loaded: boolean | null;
    batteries: boolean | null;
    fuel_cans: boolean | null;
    ppe: boolean | null;
  };
}

export interface InspectionPhoto {
  path: string; // storage object path: warehouse/inspections/{id}/{filename}
  caption: string | null;
}

export interface Inspection {
  id: string;
  truck_id: string | null;
  trailer_id: string | null;
  equipment_id: string | null;
  pull_list_id: string | null;
  inspector_employee_id: string | null;
  inspector: string;
  inspected_at: string;
  items: InspectionItems;
  result: InspectionResult;
  failure_notes: string | null;
  photos: InspectionPhoto[];
  created_at: string;
  updated_at: string;
}

export interface DeliveryMaterials {
  turf?: { product: string; sqft: number; batch: string };
  dg?: { cubic_yards: number };
  infill?: { type: string; bags: number };
  fasteners?: { nails_boxes: number; staples_boxes: number };
}

export interface Delivery {
  id: string;
  pull_list_id: string | null;
  jobber_visit_id: string | null;
  client_id: string | null;
  client_name: string | null;
  address: string | null;
  delivered_at: string;
  materials: DeliveryMaterials;
  received_by_employee_id: string | null;
  received_by: string | null;
  staging_location: string | null;
  notes: string | null;
  photo_url: string | null;
  slack_channel: string | null;
  slack_message_ts: string | null;
  slack_posted_at: string | null;
  /** UUID FK to profiles.id (the OS user who logged the delivery). */
  created_by_profile: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Vehicle maintenance now lives in the existing `maintenance_logs` table
 * (richer — has schedule FK + meter_value + role-gated RLS). This type
 * mirrors the columns the warehouse UI cares about; full type lives in
 * src/lib/database.types.ts once regenerated.
 */
export interface MaintenanceLog {
  id: string;
  asset_id: string;
  schedule_id: string | null;
  performed_at: string;
  description: string;
  cost_cents: number;
  /** mileage or hours at service (covers what variant called `odometer`) */
  meter_value: number | null;
  performed_by_profile: string | null;
  performed_by_vendor: string | null;
  /** vendor name — added in B1 if not already present */
  vendor: string | null;
  /** signed URL or storage path under `warehouse/maintenance/{id}/...` */
  invoice_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface ToolPurchase {
  id: string;
  asset_id: string | null;
  purchase_date: string;
  item_name: string;
  vendor: string | null;
  quantity: number;
  cost_cents: number;
  category: ToolCategory;
  crew: string | null;
  receipt_url: string | null;
  submitted_by_employee_id: string | null;
  /** OS user who logged it (optional — submission may come from a non-user). */
  submitted_by_profile: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  kind: BudgetKind;
  asset_id: string | null;
  period_start: string;
  period_end: string;
  amount_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Checklist schema — single source of truth for the inspection form UI.
// The Inspection.items JSONB must match these keys exactly.
// ---------------------------------------------------------------------------

export const INSPECTION_CHECKLIST = [
  {
    section: "trailer" as const,
    label: "Trailer Inspection",
    items: [
      { key: "tires", label: "Tires properly inflated, no visible damage" },
      { key: "lights", label: "Lights functioning (brake, turn, running)" },
      { key: "hitch", label: "Hitch connection secure" },
      { key: "chains", label: "Safety chains attached and crossed" },
      { key: "dump", label: "Dump mechanism operational (dump trailers)" },
      { key: "ramps", label: "Ramps secure and functional" },
    ],
  },
  {
    section: "truck" as const,
    label: "Truck Inspection",
    items: [
      { key: "fuel", label: "Fuel level adequate for route" },
      { key: "oil", label: "Oil level checked" },
      { key: "tire_pressure", label: "Tire pressure acceptable" },
      { key: "brakes", label: "Brake function verified" },
      { key: "mirrors", label: "Mirrors adjusted properly" },
    ],
  },
  {
    section: "heavy_equipment" as const,
    label: "Heavy Equipment (if transporting)",
    items: [
      { key: "secured", label: "Equipment secured with straps/chains" },
      { key: "ramps_stowed", label: "Ramps properly stowed" },
      { key: "fuel", label: "Equipment fuel level adequate" },
      { key: "no_leaks", label: "No fluid leaks visible" },
    ],
  },
  {
    section: "tools" as const,
    label: "Tools and Accessories",
    items: [
      { key: "loaded", label: "All required tools loaded" },
      { key: "batteries", label: "Power tools have charged batteries" },
      { key: "fuel_cans", label: "Fuel cans filled (for gas equipment)" },
      { key: "ppe", label: "Personal protective equipment included" },
    ],
  },
] as const;

export function emptyInspectionItems(): InspectionItems {
  return {
    trailer: { tires: null, lights: null, hitch: null, chains: null, dump: null, ramps: null },
    truck: { fuel: null, oil: null, tire_pressure: null, brakes: null, mirrors: null },
    heavy_equipment: { secured: null, ramps_stowed: null, fuel: null, no_leaks: null },
    tools: { loaded: null, batteries: null, fuel_cans: null, ppe: null },
  };
}
