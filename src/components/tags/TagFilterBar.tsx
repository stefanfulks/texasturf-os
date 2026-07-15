"use client"

import { chipClasses } from "@/lib/tags/colors"
import type { AppliedTag } from "@/lib/tags/types"

export function TagFilterBar({
  tags, selected, onToggle,
}: {
  tags: AppliedTag[]
  selected: Set<string>
  onToggle: (tagId: string) => void
}) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const on = selected.has(t.id)
        return (
          <button key={t.id} onClick={() => onToggle(t.id)}
            className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
              on ? chipClasses(t.color) : "border-line text-ink-3 hover:bg-ink/5"
            }`}>
            {t.name}
          </button>
        )
      })}
    </div>
  )
}
