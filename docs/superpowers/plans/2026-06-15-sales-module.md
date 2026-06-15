# Sales Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Supabase-backed sales pipeline (board, deal pages, risk intelligence, forecast, Turfy pipeline tools) to texasturf-os, porting Evergreen's UI + tested logic and re-skinning to texasturf-os tokens.

**Architecture:** New `(app)/sales` section. Server components load deals/contacts/activities from three new RLS-protected tables via `src/lib/sales/queries.ts`; client components mutate via server actions in `src/app/(app)/sales/actions.ts`. Pure risk/rollup logic ports from Evergreen into `src/lib/sales` (vitest). Turfy gains three tools backed by that logic. Code typechecks before the migration is applied by using hand-written types in `src/lib/sales/types.ts`.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), Supabase (Postgres + RLS, SSR client), Anthropic SDK (Turfy tools), vitest (new), Tailwind v4 tokens.

**Source to port from:** `/Users/stefanfulks/texasturf-claude/evergreen-crm/src/` (already in the tree). **Target repo:** `/Users/stefanfulks/texasturf-claude/texasturf-os`.

## Constraints (carry into every task)

- **Public repo** — no costs, margins, or secrets in code/comments. Seed only generic structure, never real pricing.
- **Prod DDL is gated** — there is no local Supabase; `typegen` and the migration both hit prod `ybedvthhofoutbqgwnvm`. Task 1's *apply* step REQUIRES Stefan's explicit named-prod approval and runs via the Supabase Management API (direct `db push` has a stale password). Do not apply DDL without that approval.
- **Don't self-push** — leave all edits uncommitted in the working tree; Stefan's `/ship` pipeline commits + deploys. Verify via Vercel `get_deployment` (project under team) READY.
- **Type/migration decoupling** — all app code imports from `src/lib/sales/types.ts` (hand-written), so `pnpm typecheck`/`build` pass before the tables exist. After the migration applies, `pnpm typegen` regenerates `database.types.ts` and Task 9 adds matching aliases to `db-helpers.types.ts`.

## Token map (apply in every ported component)

| Evergreen class | texasturf-os class |
| --- | --- |
| `bg-canvas` | `bg-canvas` (same) |
| `bg-card` / `bg-white` | `bg-surface` |
| `text-ink` | `text-ink` (same) |
| `text-fog` | `text-ink-3` |
| `border-line` / `border-line-strong` | `border-line` / `border-line-strong` (same) |
| `text-moss` / `text-moss-deep` / `bg-moss` | `text-brand` / `text-brand-strong` / `bg-brand` |
| `bg-mint-soft` | `bg-brand-tint` |
| `border-mint` / `bg-mint` | `border-brand-line` |
| `text-violet*` / `bg-violet*` | reuse `brand` family (no separate AI color in texasturf-os; pipeline AI lives in Turfy, not a colored panel) |
| `text-amber` / `bg-amber-soft` | `text-warn` / `bg-warn-tint` |
| `text-red` / `bg-red-soft` | `text-danger` / `bg-danger-tint` (Task 2 adds these tokens if absent) |
| `font-display` (Archivo) / `font-mono` (Space Mono) | texasturf-os's existing display + mono utilities — do NOT import Evergreen fonts |

---

## File structure

```
supabase/migrations/20260615120000_sales_module.sql      Create
src/lib/sales/types.ts            Create   hand types (Deal, SalesContact, DealActivity, enums, constants)
src/lib/sales/labels.ts           Create   STAGE/SERVICE/SEGMENT labels, STAGE_WEIGHTS, STALE_THRESHOLDS, STAGE_TASK_TEMPLATES
src/lib/sales/risk.ts             Create   ported assessDeal
src/lib/sales/rollups.ts          Create   ported rollups
src/lib/sales/queries.ts          Create   server-side reads (RLS)
src/lib/sales/__tests__/risk.test.ts       Create (ported)
src/lib/sales/__tests__/rollups.test.ts    Create (ported)
vitest.config.ts                  Create
src/app/(app)/sales/page.tsx              Modify (calculator landing → pipeline board)
src/app/(app)/sales/actions.ts            Create   server actions (mutations)
src/app/(app)/sales/deals/[id]/page.tsx   Create   deal detail
src/app/(app)/sales/calculator/page.tsx   Create   (move existing calculator here)
src/components/sales/PipelineBoard.tsx     Create (ported)
src/components/sales/DealCard.tsx          Create (ported)
src/components/sales/DealTable.tsx         Create (ported)
src/components/sales/StageTracker.tsx      Create (ported)
src/components/sales/StageTasks.tsx        Create (ported)
src/components/sales/ActivityTimeline.tsx  Create (ported)
src/components/sales/RiskPanel.tsx         Create (ported, de-violet)
src/components/sales/HealthDot.tsx         Create (ported)
src/components/sales/JobberHandoff.tsx     Create   Won→Jobber panel + client-link picker
src/lib/assistant/tools.ts                 Modify   +3 tool defs, +3 runTool cases
src/components/nav-links.tsx               Modify   + Sales nav entry
src/app/(app)/dashboard/page.tsx           Modify   + pipeline strip
src/lib/db-helpers.types.ts                Modify   + sales aliases (after typegen)
```

---

### Task 1: Database migration (write now, apply gated)

**Files:** Create `supabase/migrations/20260615120000_sales_module.sql`

- [ ] **Step 1: Write the migration.**

```sql
-- Sales module: pipeline that lives upstream of Jobber.
-- sales_contacts = prospects not yet in Jobber; deals = pipeline; deal_activities = timeline (+ comms landing zone).

create table if not exists public.sales_contacts (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  company          text,
  email            text,
  phone            text,
  segment          text,
  city             text,
  source           text,
  notes            text,
  jobber_client_id text references public.jobber_clients(id) on delete set null,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.deals (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  stage               text not null default 'lead',
  value_usd           numeric,
  service_line        text,
  sqft                integer,
  expected_close_date date,
  next_step           text,
  next_step_date      date,
  notes               text,
  stage_tasks         jsonb not null default '{}'::jsonb,
  owner_id            uuid references auth.users(id),
  sales_contact_id    uuid references public.sales_contacts(id) on delete set null,
  jobber_client_id    text references public.jobber_clients(id) on delete set null,
  stage_entered_at    timestamptz not null default now(),
  closed_at           timestamptz,
  lost_reason         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint deals_has_party check (sales_contact_id is not null or jobber_client_id is not null)
);

create table if not exists public.deal_activities (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  kind        text not null,
  body        text,
  direction   text,
  metadata    jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create index if not exists deals_stage_idx           on public.deals(stage);
create index if not exists deals_owner_idx           on public.deals(owner_id);
create index if not exists deals_close_idx           on public.deals(expected_close_date);
create index if not exists deal_activities_deal_idx  on public.deal_activities(deal_id, occurred_at desc);
create index if not exists sales_contacts_jobber_idx on public.sales_contacts(jobber_client_id);

alter table public.sales_contacts  enable row level security;
alter table public.deals           enable row level security;
alter table public.deal_activities enable row level security;

-- Internal team tool: any authenticated user has full access (mirrors jobber_clients access model).
create policy sales_contacts_authd  on public.sales_contacts  for all to authenticated using (true) with check (true);
create policy deals_authd           on public.deals           for all to authenticated using (true) with check (true);
create policy deal_activities_authd on public.deal_activities for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Verify the SQL parses locally** (no DB write): `cat supabase/migrations/20260615120000_sales_module.sql | head -5` and eyeball — there is no local Postgres to dry-run against, so correctness is by review. Confirm: 3 tables, 3 policies, FK to `jobber_clients(id)` (text), check constraint present.
- [ ] **Step 3: GATED — apply to prod.** Stop and ask Stefan for explicit named-prod approval ("apply the sales_module migration to the production database ybedvthhofoutbqgwnvm?"). On approval, apply via the Supabase Management API path (the working route per project history), targeting project `ybedvthhofoutbqgwnvm`. Do not use `supabase db push` (stale password).
- [ ] **Step 4: Regenerate types.** Run `pnpm typegen`. Expected: `src/lib/database.types.ts` now contains `sales_contacts`, `deals`, `deal_activities`. (If apply is deferred, skip — Task 2's hand types keep the build green meanwhile.)
- [ ] **Step 5:** No commit (working tree only, per constraints).

### Task 2: Hand types + design tokens

**Files:** Create `src/lib/sales/types.ts`; Modify `src/app/globals.css`

- [ ] **Step 1: Write `src/lib/sales/types.ts`** — the shapes the app codes against, independent of typegen:

```ts
export type Stage =
  | 'lead' | 'qualified' | 'site_visit' | 'quote_sent'
  | 'negotiation' | 'closed_won' | 'closed_lost';

export type ServiceLine =
  | 'backyard_install' | 'putting_green' | 'pet_area' | 'full_landscape'
  | 'model_home' | 'duplex_package' | 'pool_partner' | 'commercial' | 'hoa_amenity';

export type Segment = 'A' | 'B' | 'C' | 'D' | 'E' | 'R';
export type Health = 'green' | 'amber' | 'red';
export type RiskKind = 'stalling' | 'no_next_step' | 'past_close' | 'gone_quiet';
export interface RiskFlag { kind: RiskKind; label: string; }

export interface StageTask { id: string; label: string; done: boolean; }

export interface Deal {
  id: string;
  name: string;
  stage: Stage;
  value_usd: number | null;
  service_line: ServiceLine | null;
  sqft: number | null;
  expected_close_date: string | null;
  next_step: string | null;
  next_step_date: string | null;
  notes: string | null;
  stage_tasks: Partial<Record<Stage, StageTask[]>>;
  owner_id: string | null;
  sales_contact_id: string | null;
  jobber_client_id: string | null;
  stage_entered_at: string;
  closed_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesContact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  segment: Segment | null;
  city: string | null;
  source: string | null;
  notes: string | null;
  jobber_client_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  kind: 'note' | 'call' | 'sms' | 'email' | 'site_visit' | 'stage_change' | 'task';
  body: string | null;
  direction: 'inbound' | 'outbound' | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_by: string | null;
}
```

- [ ] **Step 2: Add risk/danger tokens if absent.** Check `src/app/globals.css` for `--color-danger`. If missing, add inside the same `@theme`/`:root` token block as the others:

```css
  --color-danger:       #b3261e;
  --color-danger-tint:  #f7e4e2;
```

- [ ] **Step 3:** `pnpm typecheck` → exit 0. No commit.

### Task 3: Labels + constants

**Files:** Create `src/lib/sales/labels.ts`

- [ ] **Step 1: Port the label/constant maps** from `evergreen-crm/src/lib/types.ts` (the non-interface exports) into `src/lib/sales/labels.ts`, importing types from `./types`:

```ts
import type { Stage, ServiceLine, Segment } from './types';

export const OPEN_STAGES: Stage[] = ['lead', 'qualified', 'site_visit', 'quote_sent', 'negotiation'];

export const STAGE_LABELS: Record<Stage, string> = {
  lead: 'Lead', qualified: 'Qualified', site_visit: 'Site Visit', quote_sent: 'Quote Sent',
  negotiation: 'Negotiation', closed_won: 'Closed Won', closed_lost: 'Closed Lost',
};

export const SERVICE_LINE_LABELS: Record<ServiceLine, string> = {
  backyard_install: 'Backyard install', putting_green: 'Putting green', pet_area: 'Pet area',
  full_landscape: 'Full landscape', model_home: 'Model home', duplex_package: 'Duplex package',
  pool_partner: 'Pool partner', commercial: 'Commercial', hoa_amenity: 'HOA amenity',
};

export const SEGMENT_LABELS: Record<Segment, string> = {
  A: 'Builders & Developers', B: 'Commercial Property', C: 'HOA & Community',
  D: 'Designers & Architects', E: 'Landscape Construction', R: 'Residential',
};

export const STAGE_WEIGHTS: Record<string, number> = {
  lead: 0.1, qualified: 0.25, site_visit: 0.4, quote_sent: 0.6, negotiation: 0.8,
};

export const STALE_THRESHOLDS: Record<string, number> = {
  lead: 7, qualified: 10, site_visit: 10, quote_sent: 14, negotiation: 14,
};

export const STAGE_TASK_TEMPLATES: Record<Stage, string[]> = {
  lead: ['Confirm contact info', 'Log lead source', 'Make first touch'],
  qualified: ['Budget range confirmed', 'Decision maker identified', 'Timeline known'],
  site_visit: ['Schedule walkthrough', 'Measure & photograph', 'Grade & access notes', 'HOA / utility constraints'],
  quote_sent: ['Takeoff complete', 'Design attached if needed', 'Proposal sent', 'Follow-up scheduled'],
  negotiation: ['Objections logged', 'Revised quote if needed', 'Verbal commit', 'Contract sent'],
  closed_won: [], closed_lost: [],
};
```

- [ ] **Step 2:** `pnpm typecheck` → 0. No commit.

### Task 4: Port risk + rollups with tests (TDD-preserving)

**Files:** Create `vitest.config.ts`, `src/lib/sales/risk.ts`, `src/lib/sales/rollups.ts`, `src/lib/sales/__tests__/{risk,rollups}.test.ts`. Modify `package.json` (add vitest + `test` script).

- [ ] **Step 1: Add vitest.** `pnpm add -D vitest`. Add to `package.json` scripts: `"test": "vitest run"`. Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: { environment: 'node', include: ['src/**/__tests__/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

- [ ] **Step 2: Port `risk.ts`.** Copy `evergreen-crm/src/lib/risk.ts` → `src/lib/sales/risk.ts`. Change: it operated on camelCase Evergreen fields (`stageEnteredAt`, `expectedCloseDate`, `nextStep`); rewrite field reads to the snake_case `Deal` from `./types` (`stage_entered_at`, `expected_close_date`, `next_step`). Import `STALE_THRESHOLDS`, `STAGE_LABELS` from `./labels`. Keep the anchor helpers inline (port `daysBetween` from `evergreen-crm/src/lib/anchor.ts` into a local `src/lib/sales/dates.ts`, or inline). `assessDeal(deal, activities, nowIso)` signature unchanged except `activities` items use `deal_id` instead of `dealId`.
- [ ] **Step 3: Port `rollups.ts`** the same way (snake_case fields; `closed_at`, `value_usd`, `service_line`, `owner_id`). Export `openPipelineValue`, `weightedPipeline`, `winRate`, `closingThisMonth`, `wonByMonth`, `revenueByServiceLine`, `ownerLeaderboard` (rename `repLeaderboard`→`ownerLeaderboard`, keyed on `owner_id`).
- [ ] **Step 4: Port the test files**, adjusting fixture field names to snake_case and importing from the new paths. Use a fixed `NOW = '2026-06-15'` constant instead of Evergreen's ANCHOR.
- [ ] **Step 5: Run** `pnpm test`. Expected: all ported assertions PASS (same logic, renamed fields). Fix field-name mismatches until green.
- [ ] **Step 6:** No commit.

### Task 5: Server data access

**Files:** Create `src/lib/sales/queries.ts`

- [ ] **Step 1: Write read functions** using the SSR client (RLS applies). Pattern mirrors `src/app/(app)/clients/page.tsx` (`createClient()` from `@/lib/supabase/server`, `.from(...).select(...)`).

```ts
import { createClient } from '@/lib/supabase/server';
import type { Deal, SalesContact, DealActivity } from './types';

export async function getOpenDeals(): Promise<Deal[]> {
  const sb = await createClient();
  const { data } = await sb.from('deals').select('*')
    .not('stage', 'in', '("closed_won","closed_lost")')
    .order('value_usd', { ascending: false });
  return (data ?? []) as Deal[];
}

export async function getAllDeals(): Promise<Deal[]> {
  const sb = await createClient();
  const { data } = await sb.from('deals').select('*');
  return (data ?? []) as Deal[];
}

export async function getDeal(id: string): Promise<Deal | null> {
  const sb = await createClient();
  const { data } = await sb.from('deals').select('*').eq('id', id).maybeSingle();
  return (data as Deal) ?? null;
}

export async function getDealActivities(dealId: string): Promise<DealActivity[]> {
  const sb = await createClient();
  const { data } = await sb.from('deal_activities').select('*')
    .eq('deal_id', dealId).order('occurred_at', { ascending: false });
  return (data ?? []) as DealActivity[];
}

export async function getContact(id: string): Promise<SalesContact | null> {
  const sb = await createClient();
  const { data } = await sb.from('sales_contacts').select('*').eq('id', id).maybeSingle();
  return (data as SalesContact) ?? null;
}

export async function searchJobberClients(q: string) {
  const sb = await createClient();
  const { data } = await sb.from('jobber_clients').select('id, name').ilike('name', `%${q}%`).limit(10);
  return data ?? [];
}
```

- [ ] **Step 2:** `pnpm typecheck` → 0. Note: `.from('deals')` will be `any`-typed until Task 1's typegen runs; the `as Deal` casts keep it sound and decoupled. No commit.

### Task 6: Server actions (mutations)

**Files:** Create `src/app/(app)/sales/actions.ts`

- [ ] **Step 1: Write server actions.** Each: `'use server'`, get `createClient()`, mutate, `revalidatePath`. Include `moveDealStage` (writes `stage`, `stage_entered_at=now()`, `closed_at` when closed; inserts a `stage_change` activity), `setNextStep`, `addNote` (inserts a `note` activity), `toggleStageTask` (updates `stage_tasks` jsonb), `linkJobberClient(dealId, jobberClientId)`, `createDeal(input)`, `createContact(input)`. Full example:

```ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Stage } from '@/lib/sales/types';

export async function moveDealStage(dealId: string, stage: Stage) {
  const sb = await createClient();
  const closed = stage === 'closed_won' || stage === 'closed_lost';
  await sb.from('deals').update({
    stage, stage_entered_at: new Date().toISOString(),
    closed_at: closed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', dealId);
  await sb.from('deal_activities').insert({
    deal_id: dealId, kind: 'stage_change', body: `Moved to ${stage.replace(/_/g, ' ')}`,
  });
  revalidatePath(`/sales/deals/${dealId}`);
  revalidatePath('/sales');
}

export async function addNote(dealId: string, body: string) {
  const sb = await createClient();
  await sb.from('deal_activities').insert({ deal_id: dealId, kind: 'note', body });
  revalidatePath(`/sales/deals/${dealId}`);
}

export async function setNextStep(dealId: string, nextStep: string | null, nextStepDate: string | null) {
  const sb = await createClient();
  await sb.from('deals').update({ next_step: nextStep, next_step_date: nextStepDate, updated_at: new Date().toISOString() }).eq('id', dealId);
  revalidatePath(`/sales/deals/${dealId}`);
}

export async function toggleStageTask(dealId: string, stage: Stage, taskId: string, tasks: Record<string, unknown>) {
  const sb = await createClient();
  await sb.from('deals').update({ stage_tasks: tasks, updated_at: new Date().toISOString() }).eq('id', dealId);
  revalidatePath(`/sales/deals/${dealId}`);
}

export async function linkJobberClient(dealId: string, jobberClientId: string) {
  const sb = await createClient();
  await sb.from('deals').update({ jobber_client_id: jobberClientId, updated_at: new Date().toISOString() }).eq('id', dealId);
  revalidatePath(`/sales/deals/${dealId}`);
}
```

(`createDeal`/`createContact` follow the same shape — insert, revalidate `/sales`.)

- [ ] **Step 2:** `pnpm typecheck` → 0. No commit.

### Task 7: UI components (port + re-skin + rewire to props/actions)

**Files:** Create the `src/components/sales/*` files listed in File structure.

For each, port the same-named Evergreen component, then apply: (a) the **token map** above; (b) **drop Evergreen fonts** (`font-display`→ texasturf-os display utility, `font-mono`→ its mono); (c) **rewire data**: components no longer read `useStore` — they receive `deals: Deal[]` / `deal: Deal` / `activities: DealActivity[]` as props and call the Task 6 server actions instead of store actions; (d) snake_case fields.

- [ ] **Step 1: `HealthDot.tsx`** — port verbatim, token map only.
- [ ] **Step 2: `DealCard.tsx`** — props `{ deal, contactName, ownerName }`; uses `assessDeal` (pass empty activities or a precomputed health prop from the page). Link → `/sales/deals/${deal.id}`.
- [ ] **Step 3: `PipelineBoard.tsx`** — `'use client'`; props `{ deals }`; `@hello-pangea/dnd` (`pnpm add @hello-pangea/dnd`); `onDragEnd` calls `moveDealStage` server action then `router.refresh()`. Columns from `OPEN_STAGES`.
- [ ] **Step 4: `DealTable.tsx`** — props `{ deals, contactNames, ownerNames }`; sortable; rows link to deal page.
- [ ] **Step 5: `StageTracker.tsx`** — props `{ deal }`; node click → `moveDealStage`.
- [ ] **Step 6: `StageTasks.tsx`** — props `{ deal }`; checkbox → `toggleStageTask` (compute next `stage_tasks` jsonb client-side from `STAGE_TASK_TEMPLATES` when empty, then pass to the action).
- [ ] **Step 7: `ActivityTimeline.tsx`** — props `{ activities, ownerNames }`.
- [ ] **Step 8: `RiskPanel.tsx`** — props `{ deal, activities }`; renders `assessDeal` flags as `warn`/`danger` chips. **Remove the violet "Evergreen Intelligence" styling and the "Summarize with AI" button** — pipeline AI is Turfy (Task 10), not an inline panel.
- [ ] **Step 9: `JobberHandoff.tsx`** — `'use client'`; shown on a `closed_won` deal with no `jobber_client_id`: presents the linked contact's name/phone/email/city as a copy-ready "create in Jobber" panel, plus a search box (calls `searchJobberClients`) to link an existing Jobber client via `linkJobberClient`.
- [ ] **Step 10:** `pnpm typecheck && pnpm lint` → 0. No commit.

### Task 8: Pages + nav

**Files:** Modify `src/app/(app)/sales/page.tsx`; Create `src/app/(app)/sales/deals/[id]/page.tsx`, `src/app/(app)/sales/calculator/page.tsx`; Modify `src/components/nav-links.tsx`.

- [ ] **Step 1: Move the calculator.** Create `src/app/(app)/sales/calculator/page.tsx` that renders the existing calculator (move `src/app/(app)/sales/materials-calculator/*` under `calculator/`, or re-export). Verify `/sales/calculator` still renders the calculator.
- [ ] **Step 2: Pipeline landing.** Rewrite `src/app/(app)/sales/page.tsx` as an async server component: load `getOpenDeals()`, build `contactName`/`ownerName` maps (query `sales_contacts` + `jobber_clients` + profiles), render `<PipelineBoard deals=... />` with a board/table toggle and a header showing `openPipelineValue`/`weightedPipeline`. Add a link to `/sales/calculator`.
- [ ] **Step 3: Deal detail.** Create `src/app/(app)/sales/deals/[id]/page.tsx` (async; `params` is a Promise — `const { id } = await params`): `getDeal(id)` (notFound if null), `getDealActivities(id)`, the linked contact/Jobber client; render header + stat cards + `StageTracker` + tabs (Overview: `StageTasks`, next-step editor, note logger; Activity: `ActivityTimeline`) + `RiskPanel` + `JobberHandoff` (when won + unlinked).
- [ ] **Step 4: Nav.** In `src/components/nav-links.tsx` add a `Sales` entry (icon from the lib already used there) pointing to `/sales`, placed near Clients.
- [ ] **Step 5:** `pnpm typecheck && pnpm lint && pnpm build` → all exit 0. No commit.

### Task 9: Reconcile generated types (post-migration)

**Files:** Modify `src/lib/db-helpers.types.ts`

- [ ] **Step 1:** Only after Task 1 applied + `pnpm typegen` ran. Add aliases:

```ts
export type DealRow = Database["public"]["Tables"]["deals"]["Row"]
export type DealInsert = Database["public"]["Tables"]["deals"]["Insert"]
export type SalesContactRow = Database["public"]["Tables"]["sales_contacts"]["Row"]
export type DealActivityRow = Database["public"]["Tables"]["deal_activities"]["Row"]
```

- [ ] **Step 2:** Confirm `src/lib/sales/types.ts` shapes still match the generated rows (they should; reconcile any nullability drift). `pnpm typecheck` → 0. No commit. (If migration is deferred, this task waits — the app still builds on the hand types.)

### Task 10: Turfy pipeline tools

**Files:** Modify `src/lib/assistant/tools.ts`

- [ ] **Step 1: Add three entries to `TOOL_DEFS`** (match the existing `{ name, description, input_schema }` shape):

```ts
{
  name: "pipeline_summary",
  description: "Sales pipeline rollups: open value, weighted value, win rate (last 90 days), and value expected to close this month.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
},
{
  name: "deals_needing_attention",
  description: "Open deals carrying risk flags (stalling, no next step, past close date, gone quiet), with the reason for each.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
},
{
  name: "search_deals",
  description: "Search open sales deals by name/account, optionally filtered by stage.",
  input_schema: { type: "object", properties: { query: { type: "string" }, stage: { type: "string" } }, additionalProperties: false },
},
```

- [ ] **Step 2: Add three `case` branches to `runTool`** that call `getAllDeals()`/`getOpenDeals()` + the ported rollups/risk and return compact JSON (names, stages, values, flag reasons). Reuse `assessDeal` with `'2026-06-15'`-style `new Date().toISOString()` as the now-anchor and activities fetched per deal only for `deals_needing_attention` (or accept "no activity" as a quiet signal to keep it one query). Keep results small (≤ ~30 deals).
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm build` → 0. No commit.

### Task 11: Dashboard pipeline strip

**Files:** Modify `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1:** Add a section: `getAllDeals()` → KPI cards (open pipeline, weighted, win rate 90d, closing this month via rollups) + a "Deals needing attention" list (top red/amber from `assessDeal`) linking to `/sales/deals/[id]`. Use existing dashboard card components/tokens.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint && pnpm build` → 0. No commit.

### Task 12: Verify + hand to /ship

- [ ] **Step 1: Full gates** (show output): `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, all exit 0.
- [ ] **Step 2: Preview walkthrough** (`preview_start`): `/sales` board renders seeded/real deals; drag a card → persists; open a deal → stage tracker + checklist + risk panel; mark Won → Jobber handoff appears; `/dashboard` strip shows numbers; ask Turfy "what's slipping?" → cites deals. Screenshot each. If the migration is deferred (no tables yet), note that the board/deal pages will be empty and Turfy returns "no deals" — UI still must render without error.
- [ ] **Step 3:** Leave everything uncommitted in the working tree. Tell Stefan it's ready for `/ship`; after his pipeline runs, confirm the Vercel deploy is READY via `get_deployment`.
- [ ] **Step 4:** Report in Stefan's format (did / doing next / his to-dos / open questions / resources).

## Self-Review

**Spec coverage:** Sales section + routes (T8) ✓; 3 tables + RLS (T1) ✓; hand-types decoupling (T2) ✓; risk+rollups ported & tested (T4) ✓; sales↔Jobber boundary + Won handoff (T6 linkJobberClient, T9 JobberHandoff) ✓; Turfy tools (T10) ✓; dashboard strip (T11) ✓; design-token re-skin (token map, every T7 step) ✓; comms-ready model (T1 deal_activities kind/direction/metadata, contact phone) ✓; migration/typegen path + prod gating (T1) ✓; verification gates (T12) ✓; don't-self-push (every "No commit") ✓; vitest introduced (T4) ✓; calculator preserved (T8 S1) ✓.

**Placeholder scan:** No TBD/TODO. Ports name an exact source file + explicit transformation (token map, snake_case, props/actions rewire) — concrete, not "similar to". ✓

**Type consistency:** `Deal`/`SalesContact`/`DealActivity` (snake_case) defined in T2, used identically T4–T11. Action names (`moveDealStage`, `addNote`, `setNextStep`, `toggleStageTask`, `linkJobberClient`, `createDeal`, `createContact`) and query names (`getOpenDeals`, `getAllDeals`, `getDeal`, `getDealActivities`, `getContact`, `searchJobberClients`) consistent across T5/T6/T7/T8/T10/T11. `ownerLeaderboard` rename noted in T4. ✓
