# Warehouse KPI Log — Design Spec

**Date:** 2026-06-16
**Source:** Nates_KPI_Tracker_TexasTurf Google Sheet
**Goal:** Rebuild the sheet inside texasturf-os so Nate can log warehouse KPIs daily and management can review/sign off without leaving the app.

## Scope

Six section logs from the sheet, each with KPI targets at the top and a per-row management sign-off:

1. Material Readiness & Prep
2. Inventory Management
3. Warehouse Ops & Organization
4. Equipment & Facilities
5. Vendor / TurfCasa
6. TexasTurf Job Fulfillment

Out of scope (v1): rolled-up KPI dashboards, charts/trends, export to PDF, email digest. Those can layer on once data exists.

## Where it lives

- Route: `/operations/kpi-log`
- Subnav: add "KPI Log" link to Operations area (next to pull-lists)
- Single page with 6 tabs, one per section

## User model

- **Office (Nate):** can create/edit own entries; cannot sign off
- **Admin:** can create/edit any entry + sign off + edit targets
- **Field:** read-only view (matches existing inventory layout pattern)

## Data model

One Supabase migration adds two tables.

### `kpi_log_sections` (seeded once)

| col | type | notes |
|---|---|---|
| id | text PK | enum-like slug: `material_readiness`, `inventory_mgmt`, `warehouse_ops`, `equipment`, `vendor_turfcasa`, `texasturf_jobs` |
| title | text | display name |
| sort_order | int | tab order |
| targets | jsonb | array of `{label, value}` for the KPI targets banner |

### `kpi_log_entries`

| col | type | notes |
|---|---|---|
| id | uuid PK | |
| section_id | text FK → kpi_log_sections | |
| entry_date | date NOT NULL | defaults to today |
| pass_fail | text CHECK in ('pass','fail','na') | rolled up from section's primary Y/N for fast filter |
| payload | jsonb NOT NULL | section-specific fields (see below) |
| notes | text | Nate's notes |
| mgmt_notes | text | management notes |
| mgmt_signed_by | uuid FK → auth.users | null = pending |
| mgmt_signed_at | timestamptz | |
| created_by | uuid FK → auth.users | |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | trigger |

**Indexes:** `(section_id, entry_date desc)`, `(section_id, mgmt_signed_by) where mgmt_signed_by is null` (pending-review filter).

**RLS:**
- SELECT: authenticated
- INSERT/UPDATE non-signoff cols: `requireOfficeOrAdmin` enforced server-side
- UPDATE `mgmt_*` cols: admin-only enforced server-side

### Section payload shapes

Stored as JSONB so we don't multiply tables. Each tab knows its own schema and validates client-side; server actions validate with zod.

```ts
// material_readiness
{ job: string, on_time: 'Y'|'N', cutting: 'pass'|'fail', delivery_on_schedule: 'Y'|'N', batch_tracked: 'Y'|'N' }

// inventory_mgmt
{ entry_type: string, description: string, accuracy_pct: number }

// warehouse_ops
{ incident_type: string, description: string, measurement: string }

// equipment
{ equipment: string, issue_type: string, duration: string, pm_completed: 'Y'|'N' }

// vendor_turfcasa
{ vendor: string, issue_type: string, order_ref: string, fulfillment_accurate: 'Y'|'N', resolution: string }

// texasturf_jobs
{ job_ref: string, issue_type: string, fulfillment_accurate: 'Y'|'N', resolution: string }
```

## UI

### Page layout (`/operations/kpi-log/page.tsx`)

```
┌─────────────────────────────────────────────────────────┐
│ KPI Log                          [Pending review (3)]   │
├─────────────────────────────────────────────────────────┤
│ [Material] [Inventory] [Warehouse Ops] [Equipment]      │
│ [Vendor]   [Jobs]                                       │
├─────────────────────────────────────────────────────────┤
│ ── KPI Targets ─────────────────────────────────────    │
│ Material Readiness: 100% on time • Delivery: 95%+ •     │
│ Batch Tracking: 100%                                    │
├─────────────────────────────────────────────────────────┤
│ + New entry  [collapsed form, click to expand]          │
├─────────────────────────────────────────────────────────┤
│ Date  Job   On Time  Cutting  Delivery  Batch  Notes  ✓│
│ ...   ...   ...      ...      ...       ...    ...    ⏳│
└─────────────────────────────────────────────────────────┘
```

- Tabs are URL-synced: `/operations/kpi-log?tab=material_readiness`
- "Pending review" pill in header filters all sections by `mgmt_signed_by IS NULL`
- New entry form pre-fills today's date, defaults Y/N selects to "Y"
- Sign-off badge per row: ✓ green (signed) or ⏳ amber (pending)
- Click row → modal with full payload + sign-off section (admin only)

### Files

| File | Purpose |
|---|---|
| `src/app/(app)/operations/kpi-log/page.tsx` | Server component, fetches sections + entries, renders tabs |
| `src/app/(app)/operations/kpi-log/_components/tab-nav.tsx` | Client tab switcher (URL-synced) |
| `src/app/(app)/operations/kpi-log/_components/targets-banner.tsx` | Renders KPI targets for active section |
| `src/app/(app)/operations/kpi-log/_components/entry-form.tsx` | Section-aware form (renders fields based on section_id) |
| `src/app/(app)/operations/kpi-log/_components/entry-table.tsx` | List with sign-off badge column |
| `src/app/(app)/operations/kpi-log/_components/signoff-modal.tsx` | Admin sign-off (notes + approve) |
| `src/lib/kpi-log/actions.ts` | Server actions: `createEntry`, `updateEntry`, `signOff`, `updateTargets` |
| `src/lib/kpi-log/schemas.ts` | Zod schemas per section payload |
| `src/lib/kpi-log/queries.ts` | `getEntries(section, opts)`, `getPendingCount()` |
| `supabase/migrations/20260616000000_kpi_log.sql` | DDL + seed sections |

## Server actions

```ts
// Office or admin
createEntry({ section_id, entry_date, payload, notes })
updateEntry({ id, payload, notes })           // only entries you created, or admin

// Admin only
signOff({ id, mgmt_notes })                    // sets mgmt_signed_by + at
unsignOff({ id })                              // back to pending (for mistakes)
updateTargets({ section_id, targets })
```

All gated via `requireOfficeOrAdmin()` / `requireAdmin()` from `src/lib/auth/require-role.ts`. RLS is the second-line defense.

## Validation & error handling

- Zod schemas per section, validated server-side before insert
- Form uses `useActionState` (matches existing pattern in `item-form.tsx`)
- On validation failure: action returns `{ error: string, fieldErrors? }`, form displays inline
- No optimistic UI in v1 — `revalidatePath('/operations/kpi-log')` after each mutation

## Testing

- Migration applies cleanly (`pnpm supabase:diff`)
- Type-check passes (zod inference flows into action signatures)
- Manual: log in as office user, create one entry per section; log in as admin, sign off; log in as field, confirm read-only
- No new unit tests required — pattern matches existing inventory CRUD which has zero tests; consistent with repo norms

## Migration / rollout

- One PR: migration + UI together
- No backfill from the Google Sheet (sheet stays as historical record; new entries start fresh in app)
- After ship, link Nate to `/operations/kpi-log` and walk through one entry in each tab

## Open questions

None blocking. If management wants Slack notifications on new entries, that's a v2 addition.
