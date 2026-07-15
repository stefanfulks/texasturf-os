import type { Tag, TaggableEntity } from "@/lib/db-helpers.types"

export type { Tag, TaggableEntity }

// One place that knows how to label and link each taggable entity type.
// `href` builds the detail-page link used by the /tags browser.
export const TAGGABLE: Record<
  TaggableEntity,
  { label: string; plural: string; href: (id: string) => string | null }
> = {
  sales_contact: { label: "Contact", plural: "Contacts", href: () => null },
  jobber_client: { label: "Client",  plural: "Clients",  href: (id) => `/clients/${id}` },
  deal:          { label: "Deal",    plural: "Deals",    href: (id) => `/sales/deals/${id}` },
  task:          { label: "Task",    plural: "Tasks",    href: (id) => `/tasks/${id}` },
  job:           { label: "Job",     plural: "Jobs",     href: (id) => `/jobs/${id}` },
  project:       { label: "Project", plural: "Projects", href: () => null },
  invoice:       { label: "Invoice", plural: "Invoices", href: (id) => `/invoices/${id}` },
}

// A tag applied to a record, joined with its registry row.
export type AppliedTag = Pick<Tag, "id" | "name" | "slug" | "color">
