import type { InvoiceStatus } from "@/lib/db-helpers.types";

/**
 * Single source of truth for how an invoice status renders — label + badge
 * classes + status dot. Shared by the invoices list, the job detail page's
 * "Invoices for this job" section, and anywhere else invoices surface so the
 * vocabulary and colors stay consistent across the app.
 */
export const INVOICE_STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; badge: string; dot: string }
> = {
  draft:              { label: "Draft",              badge: "bg-sunken text-ink-3",      dot: "bg-line-strong" },
  submitted:          { label: "Submitted",          badge: "bg-info-tint text-info",    dot: "bg-info"        },
  ocr_processing:     { label: "Processing",         badge: "bg-info-tint text-info",    dot: "bg-info"        },
  ocr_review_needed:  { label: "OCR Review",         badge: "bg-warn-tint text-warn",    dot: "bg-warn"        },
  awaiting_review:    { label: "Awaiting Review",    badge: "bg-warn-tint text-warn",    dot: "bg-warn"        },
  awaiting_approval:  { label: "Awaiting Approval",  badge: "bg-warn-tint text-warn",    dot: "bg-warn"        },
  approved:           { label: "Approved",           badge: "bg-brand-tint text-brand",  dot: "bg-brand"       },
  request_change:     { label: "Needs Changes",      badge: "bg-danger-tint text-danger", dot: "bg-danger"     },
  rejected:           { label: "Rejected",           badge: "bg-danger-tint text-danger", dot: "bg-danger"     },
  on_hold:            { label: "On Hold",            badge: "bg-sunken text-ink-3",      dot: "bg-ink-4"       },
  paid:               { label: "Paid",               badge: "bg-brand-tint text-brand",  dot: "bg-brand"       },
  archived:           { label: "Archived",           badge: "bg-hover text-ink-4",       dot: "bg-line"        },
};
