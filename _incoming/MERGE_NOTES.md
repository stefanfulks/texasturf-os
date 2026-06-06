# Merge notes — Jobber + Warehouse from the npm variant

## What this is

`_incoming/npm-variant/` is a full snapshot of the second TexasTurf OS folder
that used to live at `~/texasturf-claude/texasturf os` (an npm-based
`create-next-app`, **not** a git repo). It was a separate build that diverged
from this project (`texasturf-os`, the pnpm git repo you're in now).

It was copied in here on branch `merge/jobber-warehouse-from-npm-variant` so the
unique work is version-controlled and reviewable in one place. **Nothing is
wired into the live app yet** — the folder is excluded from `tsconfig.json`
(`"exclude": ["node_modules", "_incoming"]`) and lives outside `src/app`, so it
does not add routes and does not affect `next build`.

The original `texasturf os` folder on disk was left in place, untouched.

## Why it can't just be dropped in

The variant and this repo diverge in three structural ways:

1. **Routing** — the variant uses flat routes (`src/app/warehouse`,
   `src/app/clients`, `src/app/today`). This repo uses the `(app)` route group
   (`src/app/(app)/...`). Files have to move under `(app)` to inherit the app
   layout/auth.
2. **Supabase client API** — different helper names (see mapping below).
3. **Routes already exist** — this repo already has `src/app/(app)/warehouse`
   (roll/inventory focused). The variant's warehouse is a *different domain*
   (assets, vehicles, employees, inspections, deliveries, tools, pull-lists).
   Both currently resolve to `/warehouse`, so one has to be renamed/namespaced.

## Unique work worth keeping

**Jobber integration** (not present in this repo at all):
- `src/lib/jobber/config.ts`, `graphql.ts`, `tokens.ts`
- `src/lib/jobber/sync/clients.ts`, `sync/visits.ts`
- `src/app/api/jobber/connect`, `callback`, `webhook`, `sync/clients`, `sync/visits`
- `src/app/settings/jobber/page.tsx`, `src/app/clients/page.tsx`

**Warehouse operations module** (distinct from this repo's roll inventory):
- `src/lib/warehouse/actions.ts`, `queries.ts`, `types.ts`
- `src/app/warehouse/{assets,deliveries,employees,inspections,pull-lists,tools,vehicles}`
- `src/app/today/page.tsx`

## Adaptations required to go live

### 1. Supabase imports (rename)
| Variant (in `_incoming`)                         | This repo's equivalent                                   |
|--------------------------------------------------|----------------------------------------------------------|
| `supabaseAdmin()` from `@/lib/supabase/server`   | `createServiceClient()` from `@/lib/supabase/service`    |
| `supabaseBrowser()` from `@/lib/supabase/browser`| `createClient()` from `@/lib/supabase/client`            |
| variant server client                            | `await createClient()` from `@/lib/supabase/server`      |

`@/lib/supabase/browser.ts` is redundant here — use the existing `client.ts`.

### 2. New dependency
Add `graphql-request@^7.4.0` (used by `src/lib/jobber/graphql.ts`). Install with
pnpm to match this repo: `pnpm add graphql-request`.

### 3. Database
The variant **already ships migrations** — see
`_incoming/npm-variant/supabase/migrations/`:
- `0001_jobber_core.sql` — Jobber tables incl. `jobber_oauth_tokens`.
- `0002_warehouse_core.sql` — warehouse tables (assets, vehicles, employees,
  inspections, deliveries, tools, pull-lists).
- `0003_warehouse_storage.sql` — storage buckets/policies.

Review these against this repo's existing `supabase/` migrations for naming
collisions, renumber as needed, apply them, then regenerate
`src/lib/database.types.ts`.

### 4. Environment variables
Add to `.env.local` (template already in `_incoming/npm-variant/.env.example`):
`JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`, `JOBBER_REDIRECT_URI`,
`JOBBER_SCOPES`, `JOBBER_WEBHOOK_SECRET`, `APP_URL`.

### 5. Routing decision (needs you)
This repo's existing `/warehouse` = roll inventory. The variant's `/warehouse` =
physical ops. Pick one:
- Move variant warehouse under a new path (e.g. `/operations` or
  `/warehouse/ops`), **or**
- Merge the two warehouse landing pages into one hub with both sets of cards.

Either way, move the variant's pages into `src/app/(app)/...` so they get the
app shell + auth, and delete `_incoming/` once everything is integrated.

## Suggested order
1. `pnpm add graphql-request`
2. Write + run the Supabase migrations; regenerate `database.types.ts`
3. Move `src/lib/jobber/*` into place, fix the supabase imports, add env vars
4. Move the Jobber API routes under `(app)`/`api`, test the OAuth connect flow
5. Resolve the warehouse routing decision, move those pages under `(app)`
6. Delete `_incoming/` and remove it from `tsconfig.json` exclude
