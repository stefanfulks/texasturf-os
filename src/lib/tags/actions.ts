"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Tag, TaggableEntity } from "@/lib/db-helpers.types"
import { slugifyTag, colorForSlug } from "@/lib/tags/normalize"

// Find-or-create a tag by display name (dedupe on slug). Returns the registry row.
export async function createTag(name: string, color?: string): Promise<Tag | null> {
  const slug = slugifyTag(name)
  if (!slug) return null
  const sb = await createClient()
  const existing = await sb.from("tags").select("*").eq("slug", slug).maybeSingle()
  if (existing.data) return existing.data
  const { data: { user } } = await sb.auth.getUser()
  const { data } = await sb
    .from("tags")
    .insert({
      name: name.trim(),
      slug,
      color: color ?? colorForSlug(slug),
      created_by: user?.id ?? null,
    })
    .select("*")
    .single()
  return data ?? null
}

// Apply a tag to a record. `tag` may be a tag id (uuid) or a display name
// (created on the fly). Idempotent via the unique constraint.
export async function addTag(
  entityType: TaggableEntity,
  entityId: string,
  tag: string,
): Promise<void> {
  const sb = await createClient()
  let tagId = tag
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tag)
  if (!isUuid) {
    const created = await createTag(tag)
    if (!created) return
    tagId = created.id
  }
  const { data: { user } } = await sb.auth.getUser()
  await sb
    .from("entity_tags")
    .upsert(
      { tag_id: tagId, entity_type: entityType, entity_id: entityId, tagged_by: user?.id ?? null },
      { onConflict: "tag_id,entity_type,entity_id", ignoreDuplicates: true },
    )
}

export async function removeTag(
  entityType: TaggableEntity,
  entityId: string,
  tagId: string,
): Promise<void> {
  const sb = await createClient()
  await sb
    .from("entity_tags")
    .delete()
    .eq("tag_id", tagId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
}

// Registry admin (used by the /tags browser).
export async function renameTag(tagId: string, name: string): Promise<void> {
  const slug = slugifyTag(name)
  if (!slug) return
  const sb = await createClient()
  await sb.from("tags").update({ name: name.trim(), slug }).eq("id", tagId)
  revalidatePath("/tags")
}

export async function deleteTag(tagId: string): Promise<void> {
  const sb = await createClient()
  await sb.from("tags").delete().eq("id", tagId) // entity_tags cascade
  revalidatePath("/tags")
}
