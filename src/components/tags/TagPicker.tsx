"use client"

import { useState, useTransition } from "react"
import { X, Plus } from "lucide-react"
import { chipClasses } from "@/lib/tags/colors"
import type { AppliedTag, TaggableEntity } from "@/lib/tags/types"
import { addTag, removeTag } from "@/lib/tags/actions"

export function TagPicker({
  entityType,
  entityId,
  initialTags,
  registry,
}: {
  entityType: TaggableEntity
  entityId: string
  initialTags: AppliedTag[]
  registry: AppliedTag[] // full tag list for autocomplete
}) {
  const [tags, setTags] = useState<AppliedTag[]>(initialTags)
  const [input, setInput] = useState("")
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  const applied = new Set(tags.map((t) => t.id))
  const matches = registry
    .filter((t) => !applied.has(t.id) && t.name.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 6)
  const exact = registry.find((t) => t.name.toLowerCase() === input.trim().toLowerCase())

  function apply(tag: AppliedTag) {
    setTags((prev) => [...prev, tag])
    setInput("")
    setOpen(false)
    startTransition(() => { addTag(entityType, entityId, tag.id) })
  }

  function createAndApply(name: string) {
    // Optimistic temp chip; server creates/dedupes by slug.
    const temp: AppliedTag = { id: `temp-${name}`, name: name.trim(), slug: name, color: "slate" }
    setTags((prev) => [...prev, temp])
    setInput("")
    setOpen(false)
    startTransition(() => { addTag(entityType, entityId, name.trim()) })
  }

  function drop(tag: AppliedTag) {
    setTags((prev) => prev.filter((t) => t.id !== tag.id))
    startTransition(() => { removeTag(entityType, entityId, tag.id) })
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t.id}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${chipClasses(t.color)}`}
          >
            {t.name}
            <button onClick={() => drop(t)} className="opacity-60 hover:opacity-100" aria-label={`Remove ${t.name}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="Add tag…"
          className="min-w-24 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-3"
        />
      </div>
      {open && (input.length > 0 || matches.length > 0) && (
        <div className="absolute z-10 mt-1 w-56 rounded-lg border border-line bg-surface p-1 shadow-lg">
          {matches.map((t) => (
            <button
              key={t.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(t)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-ink/5"
            >
              <span className={`h-2.5 w-2.5 rounded-full border ${chipClasses(t.color)}`} />
              {t.name}
            </button>
          ))}
          {input.trim() && !exact && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => createAndApply(input)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-brand hover:bg-ink/5"
            >
              <Plus className="h-3 w-3" /> Create “{input.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  )
}
