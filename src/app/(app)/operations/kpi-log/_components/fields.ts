import type { SectionId } from "@/lib/kpi-log/schemas";

export type FieldDef = {
  name: string;                                  // payload key (without p_ prefix)
  label: string;
  type: "text" | "number" | "yn" | "passfail" | "textarea";
  required?: boolean;
  placeholder?: string;
};

export const SECTION_FIELDS: Record<SectionId, FieldDef[]> = {
  material_readiness: [
    { name: "job",                  label: "Job / Project",       type: "text",     required: true,  placeholder: "e.g. Smith install" },
    { name: "on_time",              label: "Material Ready On Time", type: "yn",    required: true },
    { name: "cutting",              label: "Cutting Accuracy",    type: "passfail", required: true },
    { name: "delivery_on_schedule", label: "Delivery On Schedule",type: "yn",       required: true },
    { name: "batch_tracked",        label: "Batch # Tracked",     type: "yn",       required: true },
  ],
  inventory_mgmt: [
    { name: "entry_type",   label: "Entry Type",     type: "text",   required: true, placeholder: "Audit, count, adjustment…" },
    { name: "description",  label: "Description",    type: "text",   required: true },
    { name: "accuracy_pct", label: "Accuracy %",     type: "number", required: true, placeholder: "0-100" },
  ],
  warehouse_ops: [
    { name: "incident_type", label: "Incident Type", type: "text",     required: true, placeholder: "Safety, downtime, waste, tool checkout…" },
    { name: "description",   label: "Description",   type: "text",     required: true },
    { name: "measurement",   label: "Value / Measurement", type: "text", placeholder: "e.g. 2 hours, 3%, $200" },
  ],
  equipment: [
    { name: "equipment",    label: "Equipment / Tool",       type: "text",     required: true, placeholder: "e.g. Woody, F-250, sod cutter" },
    { name: "issue_type",   label: "Issue Type",             type: "text",     required: true, placeholder: "Maintenance, repair, replacement…" },
    { name: "duration",     label: "Duration / Description", type: "text",     placeholder: "e.g. 11 days, replaced belt" },
    { name: "pm_completed", label: "Preventive Maint. Completed", type: "yn",  required: true },
  ],
  vendor_turfcasa: [
    { name: "vendor",               label: "Vendor / TurfCasa",     type: "text",    required: true, placeholder: "TurfCasa, Synthetic Grass Warehouse…" },
    { name: "issue_type",           label: "Issue Type",            type: "text",    required: true, placeholder: "Short ship, wrong roll, defect…" },
    { name: "order_ref",            label: "Order / Reference #",   type: "text",    placeholder: "Optional" },
    { name: "fulfillment_accurate", label: "Fulfillment Accurate",  type: "yn",      required: true },
    { name: "resolution",           label: "Resolution Status",     type: "text",    placeholder: "Open, resolved, escalated…" },
  ],
  texasturf_jobs: [
    { name: "job_ref",              label: "Job Reference #",       type: "text",    required: true, placeholder: "Jobber job number or client name" },
    { name: "issue_type",           label: "Issue Type",            type: "text",    required: true, placeholder: "Short, damage, delay…" },
    { name: "fulfillment_accurate", label: "Fulfillment Accurate",  type: "yn",      required: true },
    { name: "resolution",           label: "Resolution Status",     type: "text",    placeholder: "Open, resolved, escalated…" },
  ],
};
