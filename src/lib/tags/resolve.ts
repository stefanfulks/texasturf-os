import { createClient } from "@/lib/supabase/server"
import type { TaggableEntity } from "@/lib/db-helpers.types"
import { TAGGABLE } from "@/lib/tags/types"

export type ResolvedRow = { id: string; label: string; sublabel: string | null; href: string | null }

// Turns (entity_type, ids[]) into display rows for the /tags browser by
// querying each source table. One branch per wired entity type.
export async function resolveEntities(
  entityType: TaggableEntity, ids: string[],
): Promise<ResolvedRow[]> {
  if (ids.length === 0) return []
  const sb = await createClient()
  const href = (id: string) => TAGGABLE[entityType].href(id)
  switch (entityType) {
    case "deal": {
      const { data } = await sb.from("deals").select("id, name, stage").in("id", ids)
      return (data ?? []).map((d) => ({ id: d.id, label: d.name, sublabel: d.stage, href: href(d.id) }))
    }
    case "sales_contact": {
      const { data } = await sb.from("sales_contacts").select("id, name, company").in("id", ids)
      return (data ?? []).map((c) => ({ id: c.id, label: c.name, sublabel: c.company, href: null }))
    }
    case "jobber_client": {
      const { data } = await sb.from("jobber_clients").select("id, company_name, first_name, last_name").in("id", ids)
      return (data ?? []).map((c) => ({
        id: c.id, label: c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
        sublabel: null, href: href(c.id),
      }))
    }
    case "task": {
      const { data } = await sb.from("tasks").select("id, title, status").in("id", ids)
      return (data ?? []).map((t) => ({ id: t.id, label: t.title, sublabel: t.status, href: href(t.id) }))
    }
    case "job": {
      // "Jobs" are public.projects under the hood (the /jobs UI reads projects).
      const { data } = await sb.from("projects").select("id, name, status").in("id", ids)
      return (data ?? []).map((j) => ({ id: j.id, label: j.name, sublabel: j.status, href: href(j.id) }))
    }
    case "invoice": {
      const { data } = await sb.from("invoices").select("id, title, invoice_number").in("id", ids)
      return (data ?? []).map((i) => ({ id: i.id, label: i.title || i.invoice_number || i.id, sublabel: null, href: href(i.id) }))
    }
    default:
      // project: ids only (no detail route yet)
      return ids.map((id) => ({ id, label: id, sublabel: null, href: href(id) }))
  }
}
