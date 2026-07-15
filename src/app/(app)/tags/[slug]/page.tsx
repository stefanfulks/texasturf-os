import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getEntitiesForTag } from "@/lib/tags/queries"
import { resolveEntities } from "@/lib/tags/resolve"
import { TAGGABLE } from "@/lib/tags/types"
import type { TaggableEntity } from "@/lib/db-helpers.types"

export const dynamic = "force-dynamic"

export default async function TagDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = await createClient()
  const { data: tag } = await sb.from("tags").select("*").eq("slug", slug).maybeSingle()
  if (!tag) notFound()

  const grouped = await getEntitiesForTag(tag.id)
  const sections = await Promise.all(
    (Object.keys(grouped) as TaggableEntity[]).map(async (type) => ({
      type, rows: await resolveEntities(type, grouped[type]),
    })),
  )

  return (
    <div className="mx-auto max-w-4xl">
      <nav className="eyebrow flex items-center gap-1.5">
        <Link href="/tags" className="hover:text-ink">Tags</Link>
        <span>/</span>
        <span className="text-ink-2">{tag.name}</span>
      </nav>
      <h1 className="mt-1 page-title">Tagged &ldquo;{tag.name}&rdquo;</h1>
      <div className="mt-5 space-y-6">
        {sections.filter((s) => s.rows.length > 0).map((s) => (
          <div key={s.type} className="card p-4">
            <p className="eyebrow mb-2">{TAGGABLE[s.type].plural}</p>
            <ul className="space-y-1">
              {s.rows.map((r) => (
                <li key={`${s.type}-${r.id}`}>
                  {r.href ? (
                    <Link href={r.href} className="text-sm text-ink hover:underline">{r.label}</Link>
                  ) : (
                    <span className="text-sm text-ink">{r.label}</span>
                  )}
                  {r.sublabel && <span className="ml-2 text-xs text-ink-3">{r.sublabel}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {sections.every((s) => s.rows.length === 0) && (
          <p className="text-sm text-ink-3">Nothing tagged yet.</p>
        )}
      </div>
    </div>
  )
}
