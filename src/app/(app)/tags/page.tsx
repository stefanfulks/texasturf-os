import Link from "next/link"
import { listTags, getTagUsageCounts } from "@/lib/tags/queries"
import { chipClasses } from "@/lib/tags/colors"

export const dynamic = "force-dynamic"
export const metadata = { title: "Tags · TexasTurf OS" }

export default async function TagsPage() {
  const [tags, counts] = await Promise.all([listTags(), getTagUsageCounts()])
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="page-title">Tags</h1>
      <p className="mt-1 text-sm text-ink-3">
        Every tag in the workspace. Click one to see everything it&apos;s applied to.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((t) => (
          <Link key={t.id} href={`/tags/${t.slug}`}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${chipClasses(t.color)}`}>
            {t.name}
            <span className="tabular-nums opacity-70">{counts[t.id] ?? 0}</span>
          </Link>
        ))}
        {tags.length === 0 && (
          <p className="text-sm text-ink-3">
            No tags yet. Add one from any deal, client, task, job, or invoice page.
          </p>
        )}
      </div>
    </div>
  )
}
