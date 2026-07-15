import { TAG_COLORS, type TagColor } from "@/lib/tags/colors"

// Normalize a display name to a dedupe key: lowercase, spaces -> hyphens,
// drop everything that isn't [a-z0-9-], collapse and trim hyphens.
export function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

// Deterministic color from the slug so a tag's color is stable before the
// creator overrides it.
export function colorForSlug(slug: string): TagColor {
  let sum = 0
  for (let i = 0; i < slug.length; i++) sum += slug.charCodeAt(i)
  return TAG_COLORS[sum % TAG_COLORS.length]
}
