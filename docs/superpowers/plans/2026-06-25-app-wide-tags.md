# App-Wide Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared, app-wide tagging system — one tag registry plus a polymorphic link — usable on any record, with per-list filtering and a cross-entity tag browser.

**Architecture:** Two tables (`tags` registry + `entity_tags` polymorphic link, `entity_id` stored as `text` to span uuid and Jobber text PKs). A pure-logic helper module (slug + color), a server query/action layer in `src/lib/tags/`, one reusable `<TagPicker>` + `<TagChips>` client component dropped onto each entity detail page, per-list filters, and a `/tags` browser. RLS = authenticated-full-access, matching the sales module.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), Supabase (SSR client, RLS), TypeScript, Tailwind 4, lucide-react, vitest for pure-logic tests.

**Spec:** [docs/superpowers/specs/2026-06-25-app-wide-tags-design.md](../specs/2026-06-25-app-wide-tags-design.md)

**Repo rules that govern this plan (from AGENTS.md):**
- Migrations: additive DDL is pre-authorized — apply with `/migrate` (`supabase db push` → `pnpm typegen` → `pnpm typecheck`). Never hand-edit `src/lib/database.types.ts`; add aliases to `src/lib/db-helpers.types.ts`.
- Verification: no "passing" claim without a real exit code. `pnpm typecheck` and `pnpm lint` must exit 0 before each commit.
- Git: stage specific files only (never `-A`); Conventional Commits; no `Co-Authored-By` trailer.
- Server code uses the user-context client `@/lib/supabase/server` (`const sb = await createClient()`) so RLS applies.

**Surface scope note:** Phase 1 wires the entity detail pages that exist today — deal, sales-contact (rendered on the deal page; there is no standalone contact route), Jobber client, task, job, invoice. `project` stays in the enum (future-ready) but is NOT wired — there is no `projects/[id]` route yet. Tasks render no `.tags` UI today, so there is no old editor to remove.

---

### Task 1: Migration — tags registry, polymorphic link, RLS

**Files:**
- Create: `supabase/migrations/20260625120000_app_wide_tags.sql`
- Modify: `src/lib/db-helpers.types.ts` (add aliases)

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260625120000_app_wide_tags.sql`:

```sql
-- App-wide tags: one shared registry (tags) + a polymorphic link (entity_tags).
-- entity_id is TEXT so it spans uuid PKs (sales_contacts, deals, tasks, jobs,
-- invoices) and Jobber's text PKs (jobber_clients). Polymorphic => no FK to the
-- target rows; orphan cleanup is handled in app logic, not a cascade.

do $$ begin
  create type public.taggable_entity as enum (
    'sales_contact', 'jobber_client', 'deal', 'task', 'job', 'project', 'invoice'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  color      text not null default 'slate',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.entity_tags (
  id          uuid primary key default gen_random_uuid(),
  tag_id      uuid not null references public.tags(id) on delete cascade,
  entity_type public.taggable_entity not null,
  entity_id   text not null,
  tagged_by   uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  constraint entity_tags_unique unique (tag_id, entity_type, entity_id)
);

create index if not exists entity_tags_entity_idx on public.entity_tags(entity_type, entity_id);
create index if not exists entity_tags_tag_idx     on public.entity_tags(tag_id);

alter table public.tags        enable row level security;
alter table public.entity_tags enable row level security;

-- Internal team tool: any authenticated user has full access (mirrors sales module).
drop policy if exists tags_authd        on public.tags;
drop policy if exists entity_tags_authd on public.entity_tags;
create policy tags_authd        on public.tags        for all to authenticated using (true) with check (true);
create policy entity_tags_authd on public.entity_tags for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply the migration and regenerate types**

Run the `/migrate` workflow (or manually):
```bash
pnpm exec supabase db push
pnpm typegen
```
Expected: `supabase migration list` shows `20260625120000_app_wide_tags` under the Remote column; `git diff src/lib/database.types.ts --stat` shows the file changed (new `tags`, `entity_tags`, `taggable_entity`).

- [ ] **Step 3: Add hand-curated aliases**

In `src/lib/db-helpers.types.ts`, after the existing Task types block, add:
```typescript
// Tags
export type Tag = Database["public"]["Tables"]["tags"]["Row"]
export type TagInsert = Database["public"]["Tables"]["tags"]["Insert"]
export type EntityTag = Database["public"]["Tables"]["entity_tags"]["Row"]
export type EntityTagInsert = Database["public"]["Tables"]["entity_tags"]["Insert"]
export type TaggableEntity = Database["public"]["Enums"]["taggable_entity"]
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260625120000_app_wide_tags.sql src/lib/db-helpers.types.ts src/lib/database.types.ts
git commit -m "feat(tags): add tags + entity_tags schema and type aliases"
```

---

### Task 2: Pure helpers — slug + color (TDD)

**Files:**
- Create: `src/lib/tags/colors.ts`
- Create: `src/lib/tags/normalize.ts`
- Test: `src/lib/tags/__tests__/normalize.test.ts`

- [ ] **Step 1: Write the color palette**

Create `src/lib/tags/colors.ts`:
```typescript
// Fixed swatch palette. tags.color stores the KEY; UI maps key -> Tailwind classes.
export const TAG_COLORS = [
  "slate", "red", "amber", "green", "blue",
  "violet", "pink", "teal", "orange", "gray",
] as const

export type TagColor = (typeof TAG_COLORS)[number]

// chip = background + text + border classes for a given color key.
export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  slate:  "bg-slate-100 text-slate-700 border-slate-200",
  red:    "bg-red-100 text-red-700 border-red-200",
  amber:  "bg-amber-100 text-amber-800 border-amber-200",
  green:  "bg-green-100 text-green-700 border-green-200",
  blue:   "bg-blue-100 text-blue-700 border-blue-200",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  pink:   "bg-pink-100 text-pink-700 border-pink-200",
  teal:   "bg-teal-100 text-teal-700 border-teal-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  gray:   "bg-gray-100 text-gray-700 border-gray-200",
}

export function chipClasses(color: string): string {
  return TAG_COLOR_CLASSES[(color as TagColor)] ?? TAG_COLOR_CLASSES.slate
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/tags/__tests__/normalize.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { slugifyTag, colorForSlug } from "@/lib/tags/normalize"
import { TAG_COLORS } from "@/lib/tags/colors"

describe("slugifyTag", () => {
  it("lowercases and hyphenates whitespace", () => {
    expect(slugifyTag("  Hot  Lead ")).toBe("hot-lead")
  })
  it("strips punctuation so VIP variants collapse", () => {
    expect(slugifyTag("VIP")).toBe("vip")
    expect(slugifyTag("vip")).toBe("vip")
    expect(slugifyTag("V.I.P.")).toBe("vip")
  })
  it("collapses repeated separators and trims hyphens", () => {
    expect(slugifyTag("--Spanish / English--")).toBe("spanish-english")
  })
  it("returns empty string for punctuation-only input", () => {
    expect(slugifyTag("!!!")).toBe("")
  })
})

describe("colorForSlug", () => {
  it("returns a palette color", () => {
    expect(TAG_COLORS).toContain(colorForSlug("hot-lead"))
  })
  it("is deterministic for the same slug", () => {
    expect(colorForSlug("referral")).toBe(colorForSlug("referral"))
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/tags/__tests__/normalize.test.ts`
Expected: FAIL — `Cannot find module '@/lib/tags/normalize'`.

- [ ] **Step 4: Implement the helpers**

Create `src/lib/tags/normalize.ts`:
```typescript
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/tags/__tests__/normalize.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm typecheck
git add src/lib/tags/colors.ts src/lib/tags/normalize.ts src/lib/tags/__tests__/normalize.test.ts
git commit -m "feat(tags): add slug + color helpers with tests"
```
Expected: typecheck exits 0.

---

### Task 3: Server layer — types, queries, actions

**Files:**
- Create: `src/lib/tags/types.ts`
- Create: `src/lib/tags/queries.ts`
- Create: `src/lib/tags/actions.ts`

- [ ] **Step 1: Write the entity registry types**

Create `src/lib/tags/types.ts`:
```typescript
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
```

- [ ] **Step 2: Write the queries**

Create `src/lib/tags/queries.ts`:
```typescript
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
```

- [ ] **Step 3: Write the actions**

Create `src/lib/tags/actions.ts`:
```typescript
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
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0. (If the Supabase nested-select typing for `tags(...)` returns an array rather than object, adjust the `as AppliedTag` cast to handle `row.tags?.[0]` — verify against the generated types before committing.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tags/types.ts src/lib/tags/queries.ts src/lib/tags/actions.ts
git commit -m "feat(tags): add server query + action layer"
```

---

### Task 4: Components — TagChips + TagPicker

**Files:**
- Create: `src/components/tags/TagChips.tsx`
- Create: `src/components/tags/TagPicker.tsx`

- [ ] **Step 1: Write the read-only chips**

Create `src/components/tags/TagChips.tsx`:
```tsx
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
```

- [ ] **Step 2: Write the interactive picker**

Create `src/components/tags/TagPicker.tsx`:
```tsx
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
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-accent hover:bg-ink/5"
            >
              <Plus className="h-3 w-3" /> Create “{input.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0. (If `text-ink-3`, `border-line`, `bg-surface`, or `text-accent` aren't real theme tokens, grep an existing component e.g. `src/components/sales/DealCard.tsx` for the actual class names and match them — do not invent tokens.)

- [ ] **Step 4: Commit**

```bash
git add src/components/tags/TagChips.tsx src/components/tags/TagPicker.tsx
git commit -m "feat(tags): add TagChips + TagPicker components"
```

---

### Task 5: Wire the deal + sales-contact surface

**Files:**
- Modify: `src/app/(app)/sales/deals/[id]/page.tsx`

This page is a server component that already fetches the deal and its contact. Add tags for both the **deal** and its **sales_contact** here (the contact has no standalone page).

- [ ] **Step 1: Fetch tags + registry in the page**

In `src/app/(app)/sales/deals/[id]/page.tsx`, add imports near the existing `@/lib/sales/queries` import:
```typescript
import { listTags } from "@/lib/tags/queries"
import { getTagsForEntity } from "@/lib/tags/queries"
import { TagPicker } from "@/components/tags/TagPicker"
```
After the deal + contact are loaded (where `id` and the contact id are in scope), add:
```typescript
const registry = await listTags()
const dealTags = await getTagsForEntity("deal", id)
const contactTags = deal.sales_contact_id
  ? await getTagsForEntity("sales_contact", deal.sales_contact_id)
  : []
```

- [ ] **Step 2: Render the pickers**

In the deal overview area of the JSX (near `DealOverviewForms`), add:
```tsx
<div className="card p-4">
  <p className="eyebrow mb-2">Deal tags</p>
  <TagPicker entityType="deal" entityId={id}
    initialTags={dealTags.map((t) => ({ ...t }))} registry={registry} />
</div>
{deal.sales_contact_id && (
  <div className="card p-4">
    <p className="eyebrow mb-2">Contact tags</p>
    <TagPicker entityType="sales_contact" entityId={deal.sales_contact_id}
      initialTags={contactTags} registry={registry} />
  </div>
)}
```
(Map `registry` Tag rows to `AppliedTag` shape inline if needed: `registry.map(t => ({ id:t.id, name:t.name, slug:t.slug, color:t.color }))`.)

- [ ] **Step 3: Typecheck + lint + preview**

Run: `pnpm typecheck && pnpm lint`. Expected: both exit 0.
Then verify in preview: open a deal detail page, add a tag, reload — it persists; remove it, reload — it's gone. Confirm no console errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/sales/deals/[id]/page.tsx"
git commit -m "feat(tags): tag deals and contacts on the deal detail page"
```

---

### Task 6: Wire client, task, job, invoice surfaces

For each page below: it is a server component with `id` in scope. Add the same three imports (`listTags`, `getTagsForEntity`, `TagPicker`), fetch `registry` + the entity's tags, and render one `<TagPicker>` block. The `entityType` / `entityId` per surface:

| File | entityType | entityId |
|------|-----------|----------|
| `src/app/(app)/clients/[id]/page.tsx` | `jobber_client` | the route `id` |
| `src/app/(app)/tasks/[id]/page.tsx`   | `task`          | the route `id` |
| `src/app/(app)/jobs/[id]/page.tsx`    | `job`           | the route `id` |
| `src/app/(app)/invoices/[id]/page.tsx`| `invoice`       | the route `id` |

- [ ] **Step 1: For each page, add fetch + render**

Fetch (place after `id` is resolved):
```typescript
import { listTags, getTagsForEntity } from "@/lib/tags/queries"
import { TagPicker } from "@/components/tags/TagPicker"
// ...
const registry = await listTags()
const entityTags = await getTagsForEntity("<entityType>", id)
```
Render (in a sensible spot in the page header/sidebar):
```tsx
<div className="card p-4">
  <p className="eyebrow mb-2">Tags</p>
  <TagPicker entityType="<entityType>" entityId={id}
    initialTags={entityTags}
    registry={registry.map((t) => ({ id: t.id, name: t.name, slug: t.slug, color: t.color }))} />
</div>
```
Replace `<entityType>` with the value from the table. If a page's route param isn't named `id`, use the actual param. If a page wraps content in an existing client component, pass the fetched props down rather than importing the server query in a client file.

- [ ] **Step 2: Typecheck + lint after each page**

Run: `pnpm typecheck && pnpm lint` (exit 0) after wiring each page; commit per page or per the group.

- [ ] **Step 3: Preview-verify one page per entity type**

For each: open the detail page, add and remove a tag, reload to confirm persistence, check no console errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/clients/[id]/page.tsx" "src/app/(app)/tasks/[id]/page.tsx" "src/app/(app)/jobs/[id]/page.tsx" "src/app/(app)/invoices/[id]/page.tsx"
git commit -m "feat(tags): tag clients, tasks, jobs, and invoices on their detail pages"
```

---

### Task 7: Per-list tag filter (pipeline, contacts list, task board)

Add a multi-select tag filter to the existing list views. Start with the **task board** (`src/components/tasks/task-board.tsx`) since it already has the client-side filter pattern (`scope`, `priorityFilter`), then mirror to the pipeline + clients list.

**Files:**
- Create: `src/components/tags/TagFilterBar.tsx`
- Modify: `src/components/tasks/task-board.tsx`
- Modify: `src/components/sales/PipelineBoard.tsx`
- Modify: `src/app/(app)/clients/page.tsx` (or its list component)

- [ ] **Step 1: Write the filter bar**

Create `src/components/tags/TagFilterBar.tsx`:
```tsx
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
```

- [ ] **Step 2: Pass each row's tags into the list**

In the server component feeding the board/list, batch-fetch tags and pass them down:
```typescript
import { getTagsForEntities, listTags } from "@/lib/tags/queries"
// tasks example:
const tagsByTask = await getTagsForEntities("task", tasks.map((t) => t.id))
const registry = await listTags()
// pass tagsByTask + registry as props to <TaskBoard/>
```

- [ ] **Step 3: Filter in the client component**

In `task-board.tsx`, add state + filter (mirroring the existing `priorityFilter`):
```typescript
const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
function toggleTag(id: string) {
  setSelectedTags((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
}
// inside the existing useMemo filter chain, after priority filter:
if (selectedTags.size > 0) {
  filtered = filtered.filter((t) =>
    (tagsByTask[t.id] ?? []).some((tag) => selectedTags.has(tag.id)))
}
```
Render `<TagFilterBar tags={registry} selected={selectedTags} onToggle={toggleTag} />` near the existing filter controls, and render `<TagChips tags={tagsByTask[task.id] ?? []} />` on each card.

- [ ] **Step 4: Mirror to pipeline + clients list**

Repeat Steps 2–3 for `PipelineBoard.tsx` (entityType `deal`, batch on deal ids) and the clients list (entityType `jobber_client`). Same `TagFilterBar` + `TagChips` + ANY-match filter.

- [ ] **Step 5: Typecheck + lint + preview + commit**

Run: `pnpm typecheck && pnpm lint` (exit 0). Preview: select a tag in each list, confirm the list narrows to matching rows. Commit:
```bash
git add src/components/tags/TagFilterBar.tsx src/components/tasks/task-board.tsx src/components/sales/PipelineBoard.tsx "src/app/(app)/clients/page.tsx"
git commit -m "feat(tags): add per-list tag filtering to tasks, pipeline, clients"
```

---

### Task 8: The /tags browser page

**Files:**
- Create: `src/app/(app)/tags/page.tsx`
- Create: `src/app/(app)/tags/[slug]/page.tsx`
- Create: `src/lib/tags/resolve.ts`

- [ ] **Step 1: Write the index page**

Create `src/app/(app)/tags/page.tsx`:
```tsx
import Link from "next/link"
import { listTags, getTagUsageCounts } from "@/lib/tags/queries"
import { chipClasses } from "@/lib/tags/colors"

export const dynamic = "force-dynamic"

export default async function TagsPage() {
  const [tags, counts] = await Promise.all([listTags(), getTagUsageCounts()])
  return (
    <div className="p-6">
      <h1 className="display text-2xl">Tags</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((t) => (
          <Link key={t.id} href={`/tags/${t.slug}`}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${chipClasses(t.color)}`}>
            {t.name}
            <span className="tabular-nums opacity-70">{counts[t.id] ?? 0}</span>
          </Link>
        ))}
        {tags.length === 0 && <p className="text-ink-3">No tags yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the resolver**

Create `src/lib/tags/resolve.ts` — turns `(entity_type, ids[])` into display rows `{ id, label, sublabel, href }` by querying each source table. Implement one branch per wired entity type:
```typescript
import { createClient } from "@/lib/supabase/server"
import type { TaggableEntity } from "@/lib/db-helpers.types"
import { TAGGABLE } from "@/lib/tags/types"

export type ResolvedRow = { id: string; label: string; sublabel: string | null; href: string | null }

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
    case "invoice": {
      const { data } = await sb.from("invoices").select("id, title").in("id", ids)
      return (data ?? []).map((i) => ({ id: i.id, label: i.title ?? i.id, sublabel: null, href: href(i.id) }))
    }
    default:
      // job, project: ids only (no extra columns resolved in Phase 1)
      return ids.map((id) => ({ id, label: id, sublabel: null, href: href(id) }))
  }
}
```
(Verify each table's real column names against `src/lib/database.types.ts` before finalizing — adjust `select` lists to match.)

- [ ] **Step 3: Write the tag detail page**

Create `src/app/(app)/tags/[slug]/page.tsx`:
```tsx
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
    <div className="p-6">
      <h1 className="display text-2xl">Tagged “{tag.name}”</h1>
      <div className="mt-4 space-y-6">
        {sections.filter((s) => s.rows.length > 0).map((s) => (
          <div key={s.type}>
            <p className="eyebrow mb-2">{TAGGABLE[s.type].plural}</p>
            <ul className="space-y-1">
              {s.rows.map((r) => (
                <li key={`${s.type}-${r.id}`}>
                  {r.href ? <Link href={r.href} className="text-sm hover:underline">{r.label}</Link>
                          : <span className="text-sm">{r.label}</span>}
                  {r.sublabel && <span className="ml-2 text-xs text-ink-3">{r.sublabel}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {sections.every((s) => s.rows.length === 0) && <p className="text-ink-3">Nothing tagged yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add a nav entry**

Add a "Tags" link to the app nav/sidebar (find the existing nav config — grep for an existing route label like "Vendors" in `src/components` or `src/app/(app)/layout.tsx` — and add `{ href: "/tags", label: "Tags" }` matching that shape).

- [ ] **Step 5: Typecheck + lint + preview + commit**

Run: `pnpm typecheck && pnpm lint` (exit 0). Preview: visit `/tags`, click a tag, confirm grouped records appear and links work. Commit:
```bash
git add "src/app/(app)/tags/page.tsx" "src/app/(app)/tags/[slug]/page.tsx" src/lib/tags/resolve.ts
git commit -m "feat(tags): add /tags browser with cross-entity grouping"
```

---

### Task 9: Backfill existing tasks.tags

**Files:**
- Create: `scripts/backfill-task-tags.mjs`

The `tasks.tags text[]` column predates this system and is likely empty, but back-fill defensively so nothing is lost before a later column drop.

- [ ] **Step 1: Write the backfill script**

Create `scripts/backfill-task-tags.mjs` (mirror the structure of `scripts/import-inventory.mjs` for Supabase service-role client setup + `--dry-run` flag):
```javascript
// Reads each task's tags text[], upserts into the tags registry (slug dedupe),
// then inserts entity_tags(task, task.id). Idempotent. Service-role (trusted
// backfill, run locally). Usage: node scripts/backfill-task-tags.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js"

const slugify = (s) => s.toLowerCase().trim().replace(/\s+/g, "-")
  .replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "")
const COLORS = ["slate","red","amber","green","blue","violet","pink","teal","orange","gray"]
const colorFor = (slug) => COLORS[[...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]

const dry = process.argv.includes("--dry-run")
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: tasks } = await sb.from("tasks").select("id, tags")
let registry = {} // slug -> id
const { data: existing } = await sb.from("tags").select("id, slug")
for (const t of existing ?? []) registry[t.slug] = t.id

let applied = 0
for (const task of tasks ?? []) {
  for (const raw of task.tags ?? []) {
    const slug = slugify(raw); if (!slug) continue
    if (!registry[slug]) {
      if (dry) { console.log(`would create tag ${slug}`); registry[slug] = `dry-${slug}`; }
      else {
        const { data } = await sb.from("tags").insert({ name: raw.trim(), slug, color: colorFor(slug) }).select("id").single()
        registry[slug] = data.id
      }
    }
    if (!dry) {
      await sb.from("entity_tags").upsert(
        { tag_id: registry[slug], entity_type: "task", entity_id: task.id },
        { onConflict: "tag_id,entity_type,entity_id", ignoreDuplicates: true })
    }
    applied++
  }
}
console.log(`${dry ? "[dry-run] " : ""}processed ${applied} task-tag links`)
```

- [ ] **Step 2: Dry-run, then run**

Run: `node scripts/backfill-task-tags.mjs --dry-run`
Expected: prints a count (likely `processed 0 task-tag links` if the column is empty). If non-zero, run for real: `node scripts/backfill-task-tags.mjs`.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-task-tags.mjs
git commit -m "chore(tags): add one-time tasks.tags backfill script"
```

---

## Final verification (whole feature)

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm exec vitest run src/lib/tags` passes
- [ ] `pnpm build` completes with no error
- [ ] Preview pass: tag add/remove persists on a deal, client, task; `/tags` browser groups correctly; a list filter narrows by tag
- [ ] Push `main` (Vercel auto-deploys) per AGENTS.md §7 standing authorization, then move to the power dialer plan
