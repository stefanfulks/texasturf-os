import { z } from "zod";

// The six section slugs match the seed in 20260616120000_kpi_log.sql.
export const SECTION_IDS = [
  "material_readiness",
  "inventory_mgmt",
  "warehouse_ops",
  "equipment",
  "vendor_turfcasa",
  "texasturf_jobs",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export const YN = z.enum(["Y", "N"]);
export const PassFail = z.enum(["pass", "fail", "na"]);

const materialReadinessPayload = z.object({
  job:                  z.string().min(1, "Job is required"),
  on_time:              YN,
  cutting:              z.enum(["pass", "fail"]),
  delivery_on_schedule: YN,
  batch_tracked:        YN,
});

const inventoryMgmtPayload = z.object({
  entry_type:   z.string().min(1, "Entry type is required"),
  description:  z.string().min(1, "Description is required"),
  accuracy_pct: z.coerce.number().min(0).max(100),
});

const warehouseOpsPayload = z.object({
  incident_type: z.string().min(1, "Incident type is required"),
  description:   z.string().min(1, "Description is required"),
  measurement:   z.string().optional().default(""),
});

const equipmentPayload = z.object({
  equipment:     z.string().min(1, "Equipment is required"),
  issue_type:    z.string().min(1, "Issue type is required"),
  duration:      z.string().optional().default(""),
  pm_completed:  YN,
});

const vendorTurfcasaPayload = z.object({
  vendor:                z.string().min(1, "Vendor is required"),
  issue_type:            z.string().min(1, "Issue type is required"),
  order_ref:             z.string().optional().default(""),
  fulfillment_accurate:  YN,
  resolution:            z.string().optional().default(""),
});

const texasturfJobsPayload = z.object({
  job_ref:               z.string().min(1, "Job reference is required"),
  issue_type:            z.string().min(1, "Issue type is required"),
  fulfillment_accurate:  YN,
  resolution:            z.string().optional().default(""),
});

export const SECTION_SCHEMAS = {
  material_readiness: materialReadinessPayload,
  inventory_mgmt:     inventoryMgmtPayload,
  warehouse_ops:      warehouseOpsPayload,
  equipment:          equipmentPayload,
  vendor_turfcasa:    vendorTurfcasaPayload,
  texasturf_jobs:     texasturfJobsPayload,
} as const satisfies Record<SectionId, z.ZodTypeAny>;

export type SectionPayload<S extends SectionId> = z.infer<(typeof SECTION_SCHEMAS)[S]>;

// Derive pass/fail summary from the payload — used for the column badge + filter.
export function rollupPassFail<S extends SectionId>(
  section: S,
  payload: SectionPayload<S>,
): "pass" | "fail" | "na" {
  const p = payload as Record<string, unknown>;
  switch (section) {
    case "material_readiness":
      return p.on_time === "Y" && p.delivery_on_schedule === "Y" && p.batch_tracked === "Y" && p.cutting === "pass"
        ? "pass" : "fail";
    case "inventory_mgmt":
      return typeof p.accuracy_pct === "number" && p.accuracy_pct >= 95 ? "pass" : "fail";
    case "warehouse_ops":
      return "na";
    case "equipment":
      return p.pm_completed === "Y" ? "pass" : "fail";
    case "vendor_turfcasa":
    case "texasturf_jobs":
      return p.fulfillment_accurate === "Y" ? "pass" : "fail";
    default:
      return "na";
  }
}

export const entryDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const SECTION_TITLES: Record<SectionId, string> = {
  material_readiness: "Material Readiness & Prep",
  inventory_mgmt:     "Inventory Management",
  warehouse_ops:      "Warehouse Ops & Organization",
  equipment:          "Equipment & Facilities",
  vendor_turfcasa:    "Vendor Relations & TurfCasa",
  texasturf_jobs:     "TexasTurf Job Fulfillment",
};

export function isSectionId(s: string): s is SectionId {
  return (SECTION_IDS as readonly string[]).includes(s);
}
