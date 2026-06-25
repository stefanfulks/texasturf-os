# App-Wide Tags — Design

**Date:** 2026-06-25
**Surfaces:** every entity detail + list view (sales contacts, deals, Jobber clients, tasks, jobs, projects, invoices)
**Status:** approved to build — Phase 1
**Build order:** build this BEFORE the power dialer ([2026-06-25-power-dialer-design.md](2026-06-25-power-dialer-design.md)) — the dialer's "build a call list by tag" filter and its polymorphic `entity_type + entity_id` pattern both lean on this.

## 1. Goal

One shared tagging system usable on any record in the app: tag a contact, a deal,
a client, a task — from one shared vocabulary — and filter/browse by tag both
within a list and across the whole app ("show me everything tagged `Referral`").

Replaces the unused per-table `tasks.tags text[]` column with a single registry +
polymorphic link, so tags mean the same thing everywhere and adding a new taggable
record type later is one enum value + dropping one component on that page.

## 2. Data model

### Enum
- `taggable_entity`: `sales_contact`, `jobber_client`, `deal`, `task`, `job`,
  `project`, `invoice`. (Additive — new types are an `ALTER TYPE ... ADD VALUE`
  migration later, no rebuild.)

### `tags` (the shared registry — one row per distinct tag)
`id` (uuid, PK), `name` (text, NOT NULL — display form, e.g. "Hot Lead"),
`slug` (text, NOT NULL, UNIQUE — lowercased/normalized form, e.g. "hot-lead";
dedupes "VIP"/"vip"/"V.I.P."), `color` (text, NOT NULL — a palette key, see §5),
`created_by` (uuid → `auth.users`, nullable), `created_at` (timestamptz default now).

### `entity_tags` (the polymorphic link — one row per tag applied to one record)
`id` (uuid, PK), `tag_id` (uuid → `tags`, ON DELETE CASCADE),
`entity_type` (`taggable_entity`), `entity_id` (text — **text, not uuid**, so it
holds both uuid PKs (`sales_contacts`, `deals`, `tasks`) and Jobber's text PKs
(`jobber_clients`)), `tagged_by` (uuid → `auth.users`, nullable),
`created_at` (timestamptz default now).

- **UNIQUE** `(tag_id, entity_type, entity_id)` — can't double-tag a record.
- **INDEX** `(entity_type, entity_id)` — "all tags for this record" (detail pages).
- **INDEX** `(tag_id)` — "all records with this tag" (the `/tags` browser, filters).

Polymorphic means no DB-level FK from `entity_tags` to the target rows. Orphan
cleanup (a record is deleted) is handled by app logic / a periodic sweep, not a
cascade — acceptable and standard for cross-entity tagging.

### RLS
Internal team only — same model as the sales module: authenticated users have full
read/write on both tables. Tags are deliberately shared team-wide (the point of a
registry). Server actions use the user-context client (`@/lib/supabase/server`).

## 3. Server layer (`src/lib/tags/`)

- `types.ts` — `Tag`, `EntityTag`, `TaggableEntity`, plus a `TAGGABLE` map of
  entity_type → { label, hrefFor(id), searchTable } used by the browser + filters.
- `queries.ts` (server) — `listTags()`, `getTagsForEntity(type, id)`,
  `getTagsForEntities(type, ids[])` (batch, for list views — avoids N+1),
  `getEntitiesForTag(tagId, type?)`, `getTagUsageCounts()`.
- `actions.ts` (`'use server'`) — `createTag(name, color)` (normalizes slug,
  upserts so a duplicate name returns the existing tag), `addTag(type, id,
  tagNameOrId)` (creates-on-the-fly if a name with no match), `removeTag(type, id,
  tagId)`, `renameTag(tagId, name)`, `mergeTags(fromId, intoId)`,
  `deleteTag(tagId)`. Each `revalidatePath`s the affected surface.

## 4. UI

### `<TagPicker entityType entityId initialTags />` (client component, `src/components/tags/`)
The single reusable surface. Renders current tags as colored chips with an `x` to
remove; an input that autocompletes the registry as you type and offers
"Create '<text>'" when there's no exact match. Optimistic add/remove, calls the
server actions. Drops onto every taggable page unchanged.

### `<TagChips tags />` (read-only display)
Just the colored chips — for list rows / cards where inline editing isn't wanted.

### Phase 1 surfaces (where the components land)
- **Sales contact** detail → `<TagPicker>`; contact list rows → `<TagChips>`.
- **Deal** detail → `<TagPicker>`; pipeline card + deal table row → `<TagChips>`.
- **Jobber client** detail → `<TagPicker>`.
- **Task** detail → `<TagPicker>` (replaces the old `text[]` editor); task board
  card → `<TagChips>`.
- **Job / project / invoice** detail → `<TagPicker>`.

### Filtering & browsing
- **Per-list tag filter:** a multi-select tag-chip filter on the pipeline,
  contacts list, and task board — narrows the in-view list to records carrying ALL
  (or ANY — default ANY) selected tags. Reuses each list's existing client-filter
  pattern (e.g. `task-board.tsx`).
- **`/tags` browser page:** every tag with its usage count; click a tag → all
  records carrying it, grouped by entity type (contacts, deals, clients, tasks…),
  each row linking to the record. Reuses the grouped-results rendering from the
  command palette / `runSearch`.

## 5. Colors

A fixed palette of ~10 named swatches (`slate`, `red`, `amber`, `green`, `blue`,
`violet`, `pink`, `teal`, `orange`, `gray`) stored as the key string in
`tags.color`; the UI maps key → Tailwind classes. New tags get an auto-assigned
color (round-robin / hash of slug) that the creator can change. No free-form hex —
keeps chips visually consistent.

## 6. Migration of existing `tasks.tags`

One-time backfill (a script under `scripts/`, run once):
1. For each distinct string across all `tasks.tags`, upsert a `tags` row
   (normalized slug, auto color).
2. For each task, insert `entity_tags(tag_id, 'task', task.id)` rows.
3. Task UI switches to reading `entity_tags`. Leave the `tasks.tags` column in
   place but stop writing to it (drop in a later cleanup migration once verified —
   column drop is destructive, so it is NOT part of this build).

## 7. Out of scope for Phase 1 (YAGNI)

Tag groups/categories/namespaces, per-user or per-role tag permissions, required
tags, tag-triggered automations, tag colors as free hex, tag descriptions,
favorite/pinned tags. All can layer on without touching the core two tables.

## 8. Build checklist (one item end-to-end at a time)

1. Migration: enum + `tags` + `entity_tags` + indexes + RLS → `db push` → `typegen`
   → `typecheck`. Add `Tag`/`EntityTag` aliases to `db-helpers.types.ts`.
2. Server layer `src/lib/tags/` (types, queries, actions) + unit-level checks.
3. `<TagPicker>` + `<TagChips>` components.
4. Wire the 7 Phase-1 surfaces (one commit per surface or per logical group).
5. Per-list tag filters (pipeline, contacts, tasks).
6. `/tags` browser page.
7. Backfill script for `tasks.tags` → run once, verify.
