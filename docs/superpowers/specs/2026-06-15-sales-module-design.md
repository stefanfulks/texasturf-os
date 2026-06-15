# Sales Module — Design Spec

**Date:** 2026-06-15
**Status:** Approved by Stefan (chat, 2026-06-15)
**What it is:** Fold the Evergreen CRM pipeline into texasturf-os as a first-class **Sales** section — a real sales pipeline backed by Supabase, wired to the existing Jobber-client data and the existing Turfy assistant. Calling/SMS (Twilio) is designed-for but deferred to phase 2.

## Goal

Give TexasTurf a pipeline to manage prospects from first touch to close, inside the app the office already uses. Today `/sales` is only the materials calculator; there is no deal pipeline, deal intelligence, or forecast anywhere in texasturf-os. This adds them, reusing the Evergreen UI and its already-tested risk/rollup logic, restyled to texasturf-os's design system.

## Non-goals (v1)

- **No Twilio yet.** Calling and SMS are phase 2. The data model is built to receive them (see Comms-ready hooks) but no provider is wired and no 10DLC registration happens in v1.
- **No sequences/cadences and no separate leads workspace.** A new lead is simply a deal in the `lead` stage with a sales contact attached.
- **No automatic writes into Jobber.** Winning a deal produces a one-click, pre-filled "create in Jobber" handoff, not a silent API write (auto-create is a phase-2 candidate).
- **No second chatbot.** Pipeline AI is delivered as new tools on the existing Turfy assistant, not a separate copilot UI.
- **Not a rebuild of `/clients` or `/meetings`.** Those stay as they are; deals link to existing Jobber clients.

## Architecture

Lives in the authed route group `src/app/(app)/sales`:

| Route | Surface |
| --- | --- |
| `/sales` | Pipeline board (kanban by stage) + table toggle. Becomes the Sales landing. |
| `/sales/deals/[id]` | Deal detail: header, stat cards, stage tracker + per-stage checklist, activity timeline, risk/intelligence panel, linked contact/Jobber client. |
| `/sales/calculator` | The existing materials calculator, moved under Sales (currently at `/sales/materials-calculator`). |
| `/dashboard` (or `/today`) | Gains a pipeline strip: open pipeline $, weighted, win rate (90d), deals needing attention. |

Sidebar: "Sales" entry points at `/sales`. Components ported from `evergreen-crm/src/components` (pipeline board, deal pages, charts, ui primitives) into `src/components/sales/*`, restyled to texasturf-os tokens. Pure logic ported into `src/lib/sales/*`.

## Data model (new Supabase tables)

All tables: RLS enabled, mirroring the existing `jobber_clients` authenticated-access pattern (signed-in team members read/write; no public access). `created_by` references `auth.users(id)`. `updated_at` maintained by trigger or app.

### `sales_contacts` — prospects not yet in Jobber
```
id                uuid primary key default gen_random_uuid()
name              text not null
company           text
email             text
phone             text                      -- comms-ready (Twilio phase 2)
segment           text                      -- 'A'|'B'|'C'|'D'|'E'|'R' (builder/commercial/HOA/designer/landscape/residential)
city              text
source            text                      -- 'website' | 'referral' | 'linkedin' | ...
notes             text
jobber_client_id  text references public.jobber_clients(id)   -- set once linked/converted; null for pure prospects
created_by        uuid references auth.users(id)
created_at        timestamptz default now()
updated_at        timestamptz default now()
```

### `deals` — the pipeline
```
id                uuid primary key default gen_random_uuid()
name              text not null
stage             text not null             -- 'lead'|'qualified'|'site_visit'|'quote_sent'|'negotiation'|'closed_won'|'closed_lost'
value_usd         numeric
service_line      text                      -- 'backyard_install'|'putting_green'|'pet_area'|'full_landscape'|'model_home'|'duplex_package'|'pool_partner'|'commercial'|'hoa_amenity'
sqft              integer
expected_close_date date
next_step         text
next_step_date    date
notes             text
stage_tasks       jsonb                     -- per-stage checklist state (mirrors Evergreen's structure)
owner_id          uuid references auth.users(id)
sales_contact_id  uuid references public.sales_contacts(id)
jobber_client_id  text references public.jobber_clients(id)
stage_entered_at  timestamptz default now()
closed_at         timestamptz
lost_reason       text
created_at        timestamptz default now()
updated_at        timestamptz default now()
-- constraint: a deal must reference a prospect or a Jobber client
check (sales_contact_id is not null or jobber_client_id is not null)
```

### `deal_activities` — the deal timeline (and the comms landing zone)
```
id            uuid primary key default gen_random_uuid()
deal_id       uuid not null references public.deals(id) on delete cascade
kind          text not null            -- 'note'|'call'|'sms'|'email'|'site_visit'|'stage_change'|'task'
body          text
direction     text                     -- 'inbound'|'outbound' (used by call/sms in phase 2; null otherwise)
metadata      jsonb                    -- e.g. Twilio call/message SIDs in phase 2
occurred_at   timestamptz default now()
created_by    uuid references auth.users(id)
```

Indexes: `deals(stage)`, `deals(owner_id)`, `deals(expected_close_date)`, `deal_activities(deal_id, occurred_at desc)`.

## Sales ↔ Jobber boundary

Confirmed with Stefan: **sales owns everything pre-win; Jobber owns everything post-win.** A prospect lives only in `sales_contacts` + `deals` until the deal is marked **Closed Won**.

**Won handoff (v1, manual one-click):** moving a deal to `closed_won` with no `jobber_client_id` surfaces a "Create in Jobber" action that presents the prospect's details (name, phone, email, city) ready to create the client in Jobber — either as a deep link to Jobber's new-client screen or a copy-ready panel. After the next Jobber sync, the office links the deal by setting `jobber_client_id` (a picker on the deal that searches `jobber_clients`). Auto-create via the Jobber GraphQL API is a phase-2 enhancement, not v1.

Deals that are already existing customers can link a `jobber_client_id` directly at creation via the same picker.

## Ported logic: risk intelligence + rollups

Evergreen's `risk.ts` and `rollups.ts` are pure functions over plain deal objects and are already unit-tested. They port to `src/lib/sales/risk.ts` and `src/lib/sales/rollups.ts` essentially unchanged, operating on rows loaded from Supabase mapped to the same shape.

- **Risk flags:** stalling (stage-specific day thresholds), no next step (qualified+), past close date, gone quiet (≥14d no activity). Health = green/amber/red by flag count. Drives card dots, the intelligence panel, dashboard "needs attention", and the assistant's attention tool.
- **Rollups:** open pipeline value, weighted pipeline (stage weights), win rate over a window, closing-this-month, won-by-month, revenue by service line, owner leaderboard.

The vitest suites port with them. texasturf-os has no test runner today, so v1 introduces **vitest** as a devDependency scoped to the pure logic modules (it must not become a regression that this logic ships untested).

## AI: Turfy gains pipeline awareness

No new chatbot. Extend the existing assistant (`src/app/api/assistant/route.ts`, tools in `src/lib/assistant/tools`) with new tool definitions added to `TOOL_DEFS` / `runTool`, each querying the new tables **under the caller's RLS context** (matching every existing Turfy tool):

- `pipeline_summary` → open/weighted value, win rate, closing-this-month (via ported rollups).
- `deals_needing_attention` → open deals with risk flags + the human-readable reason for each (via ported risk).
- `search_deals(query, stage?, owner?)` → matching deals with stage, value, owner, next step.

This makes "what's slipping?", "how's the pipeline vs last quarter?", and "summarize the Sun City deal" work in the assistant Stefan already uses.

## Dashboard pipeline strip

Add a section to the existing dashboard: KPI cards (open pipeline $, weighted, win rate 90d, closing this month) and a "needs attention" list of the top red/amber deals linking into `/sales/deals/[id]`. Built with texasturf-os's existing card/stat components and tokens — not Evergreen's.

## Design system mapping

Re-skin ported components to texasturf-os tokens (no Evergreen fonts or colors imported):

| Evergreen | texasturf-os |
| --- | --- |
| canvas / card | `canvas` / `surface` |
| ink / fog | `ink` / `ink-3` |
| line / line-strong | `line` / `line-strong` |
| moss / mint-soft / mint | `brand` / `brand-tint` / `brand-line` |
| amber (risk) | `warn` / `warn-tint` |
| red (risk) | existing danger token, or add `--color-danger` + `--color-danger-tint` if absent |
| Archivo Black / Space Mono | texasturf-os's existing display + mono type |

## Comms-ready hooks (Twilio, phase 2)

Nothing wired in v1, but the model is shaped so phase 2 is additive:
- `sales_contacts.phone` holds the number to call/text.
- `deal_activities` already supports `kind in ('call','sms')` + `direction` + `metadata` (for Twilio SIDs) — calls and texts become timeline rows on the deal.
- Phase 2 adds: Twilio client + webhooks, click-to-call from a deal, a 2-way SMS thread surface, and **A2P 10DLC registration** (the long-pole; ~1–3 week carrier approval — kicked off at the start of phase 2). Calling needs no 10DLC; business SMS does.

## Migrations, types, verification, shipping

- **Migration:** one new file under `supabase/migrations/` (tables + indexes + RLS policies). Production DDL follows texasturf-os's established route and Stefan's named-prod approval (direct `db push` has a known stale-password caveat; the Supabase Management API path is the working alternative).
- **Types:** `pnpm typegen` after the migration to regenerate `src/lib/database.types.ts`; any hand aliases go in `db-helpers.types.ts`.
- **Verification (definition of done):** `pnpm typecheck`, `pnpm lint`, `pnpm build` exit 0 with output shown; vitest green for ported logic; preview walkthrough of `/sales`, a deal page, the Won→Jobber handoff, the dashboard strip, and a Turfy pipeline question. Evidence before claims.
- **Shipping:** built in the working tree and verified; Stefan's iMac `/ship` pipeline sweeps it into a deploy. Do not self-push (avoids colliding with that pipeline); confirm the deploy via Vercel.

## Build order (for the implementation plan)

1. Migration + RLS + typegen (the three tables).
2. Port risk/rollups + vitest into `src/lib/sales`.
3. Server data access (queries/mutations) for deals, contacts, activities under RLS.
4. Pipeline board at `/sales` (restyled) + deal detail page.
5. Won→Jobber handoff + Jobber-client link picker.
6. Dashboard pipeline strip.
7. Turfy pipeline tools.
8. Verify (gates + walkthrough), hand to `/ship`.
