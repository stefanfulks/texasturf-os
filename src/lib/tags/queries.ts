import { createClient } from "@/lib/supabase/server"
import type { Tag, TaggableEntity } from "@/lib/db-helpers.types"
import type { AppliedTag } from "@/lib/tags/types"

// Full registry, alphabetical.
export async function listTags(): Promise<Tag[]> {
  const sb = await createClient()
  const { data } = await sb.from("tags").select("*").order("name")
  return data ?? []
}

// Tags applied to a single record.
export async function getTagsForEntity(
  entityType: TaggableEntity,
  entityId: string,
): Promise<AppliedTag[]> {
  const sb = await createClient()
  const { data } = await sb
    .from("entity_tags")
    .select("tags(id, name, slug, color)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
  return (data ?? [])
    .map((row) => row.tags as AppliedTag | null)
    .filter((t): t is AppliedTag => t != null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Batch variant for list views — avoids N+1. Returns a map keyed by entity_id.
export async function getTagsForEntities(
  entityType: TaggableEntity,
  entityIds: string[],
): Promise<Record<string, AppliedTag[]>> {
  const out: Record<string, AppliedTag[]> = {}
  if (entityIds.length === 0) return out
  const sb = await createClient()
  const { data } = await sb
    .from("entity_tags")
    .select("entity_id, tags(id, name, slug, color)")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
  for (const row of data ?? []) {
    const tag = row.tags as AppliedTag | null
    if (!tag) continue
    ;(out[row.entity_id] ??= []).push(tag)
  }
  return out
}

// All records carrying a tag, grouped by entity_type. Returns the raw ids; the
// /tags browser resolves labels per type.
export async function getEntitiesForTag(
  tagId: string,
): Promise<Record<TaggableEntity, string[]>> {
  const sb = await createClient()
  const { data } = await sb
    .from("entity_tags")
    .select("entity_type, entity_id")
    .eq("tag_id", tagId)
  const out = {} as Record<TaggableEntity, string[]>
  for (const row of data ?? []) {
    ;(out[row.entity_type as TaggableEntity] ??= []).push(row.entity_id)
  }
  return out
}

// Usage count per tag id, for the browser.
export async function getTagUsageCounts(): Promise<Record<string, number>> {
  const sb = await createClient()
  const { data } = await sb.from("entity_tags").select("tag_id")
  const counts: Record<string, number> = {}
  for (const row of data ?? []) counts[row.tag_id] = (counts[row.tag_id] ?? 0) + 1
  return counts
}
