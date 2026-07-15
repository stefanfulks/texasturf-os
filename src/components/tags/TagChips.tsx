import { chipClasses } from "@/lib/tags/colors"
import type { AppliedTag } from "@/lib/tags/types"

export function TagChips({ tags }: { tags: AppliedTag[] }) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t.id}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${chipClasses(t.color)}`}
        >
          {t.name}
        </span>
      ))}
    </div>
  )
}
