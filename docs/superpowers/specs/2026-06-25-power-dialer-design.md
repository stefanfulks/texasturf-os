# Power Dialer — Design

**Date:** 2026-06-25
**Module home:** `/sales/dialer` (under the Sales hub)
**Status:** approved to build — Phase 1
**Depends on:** [App-Wide Tags](2026-06-25-app-wide-tags-design.md) for the
"build a call list by tag" filter. The dialer ships without it (manual +
stage/segment filters) and gains tag-filtering the moment tags land.

## 1. Goal

A **call-list power dialer**: build a named list of people (sales leads/contacts,
or past Jobber clients), open it, and the app walks the rep through them one at a
time — dial → log the outcome → auto-advance to the next. Built on the **existing
bridge calling** now; a headset browser softphone is the Phase 2 cadence upgrade,
and the engine is designed so that swap touches one function only.

Note on terminology: in this app a "lead" is a `sales_contacts` row whose `deal`
is still at `stage = 'lead'` — there is no separate `leads` table. The dialer
dials *people* regardless of label, so leads, contacts, and clients all work.

## 2. Decisions locked in brainstorming

- **Dialer mode:** phased — guided list on existing bridge calling now (works from
  a cell in the field or at a desk), headset softphone as fast-follow.
- **Sequence type:** single-session **call list** now; data model leaves room for
  multi-day cadences later without a rebuild.
- **Who you dial:** **both** sales contacts/leads AND Jobber clients — via a
  polymorphic target (`target_type + target_id`), same pattern as tags.
- **List ownership:** **team-shareable** — every list is visible to the whole team;
  `owner_id` is tracked so reps can filter "My lists."

## 3. Data model

### Enums
- `call_list_status`: `active`, `completed`, `archived`.
- `call_item_status`: `pending`, `called`, `skipped`, `done`.
- `call_outcome`: `connected`, `no_answer`, `voicemail`, `busy`, `bad_number`,
  `callback_scheduled`, `not_interested`, `do_not_call`.
- `dial_target` (reuse the tags `taggable_entity` shape, but scoped): `sales_contact`,
  `jobber_client`. (Kept separate from `taggable_entity` so the dialer doesn't
  inherit task/invoice/etc. as dialable.)

### `call_lists` (one row = one named list/campaign)
`id` (uuid, PK), `name` (text, NOT NULL), `description` (text),
`owner_id` (uuid → `auth.users`, NOT NULL), `status` (`call_list_status`,
default `active`), `created_at`, `updated_at`. Team-shared via RLS; `owner_id`
drives the "My lists" filter only.

### `call_list_items` (the people on a list)
`id` (uuid, PK), `call_list_id` (uuid → `call_lists`, ON DELETE CASCADE),
`target_type` (`dial_target`), `target_id` (text — holds uuid contacts + text
Jobber ids), `position` (integer — dial order), `status` (`call_item_status`,
default `pending`), `attempts` (integer default 0), `last_outcome`
(`call_outcome`, nullable), `called_at` (timestamptz, nullable),
`snapshot_name` / `snapshot_phone` (text — captured at add time so the row still
renders if the source record changes), `added_by` (uuid → `auth.users`),
`added_at` (timestamptz default now).

- **UNIQUE** `(call_list_id, target_type, target_id)` — no dupes on one list.
- **INDEX** `(call_list_id, position)` — ordered fetch of the active list.

### `call_attempts` (one row per dial — the dialer's own outcome log)
`id` (uuid, PK), `call_list_item_id` (uuid → `call_list_items`, ON DELETE CASCADE),
`call_list_id` (uuid → `call_lists`), `target_type` (`dial_target`),
`target_id` (text), `deal_id` (uuid → `deals`, **nullable** — linked when the
target has a deal), `rep_id` (uuid → `auth.users`), `outcome` (`call_outcome`,
nullable until the call resolves), `call_sid` (text — Twilio CallSid, for the
status webhook to match back), `duration_sec` (integer), `note` (text),
`callback_at` (timestamptz, nullable — set when outcome = `callback_scheduled`),
`created_at` (timestamptz default now).

- **INDEX** `(call_sid)` — webhook lookup.
- **INDEX** `(rep_id, created_at)` — per-rep activity / future reporting.

### RLS
Internal team only, same as sales: authenticated users have full read/write on all
three tables (lists are shared). Server actions use the user-context client.

## 4. Call engine (the pluggable seam — key design choice)

The dialer UI calls ONE server action: `placeCall({ callListItemId })`. Internally
it resolves the target's phone, creates a `call_attempts` row (status pending),
places the call, and returns. The "how" is isolated:

- **Phase 1 — bridge (reuse what exists):** generalize the current
  `startCall(dealId, contactId)` ([comms-actions.ts](../../../src/app/(app)/sales/comms-actions.ts))
  into a lower-level `placeBridgeCall({ toPhone, repId, context })` that does NOT
  require a deal (so Jobber clients work). Flow: Twilio rings the rep's cell →
  rep answers → bridged to the lead with the TexasTurf caller ID. `placeCall`
  calls `placeBridgeCall` and stamps the returned `CallSid` onto the `call_attempts`
  row.
- **Phase 2 — browser softphone:** swap `placeBridgeCall` for the Twilio Voice JS
  SDK path (a `/api/twilio/token` access-token route + a TwiML App that dials the
  lead, plus a `<Softphone>` client widget using `@twilio/voice-sdk`). **The dialer
  UI, the three tables, and outcome logging do not change** — only the body of
  `placeCall`'s mechanism branch. Out of scope for this spec beyond leaving the seam.

## 5. Timeline integration (stay wired into deal history)

The existing `voice-status` webhook
([api/twilio/voice-status](../../../src/app/api/twilio/voice-status/route.ts))
already inserts a `deal_activities` row (`kind='call'`) on completion. Extend it to:
1. Match the `call_attempts` row by `call_sid` and fill `duration_sec` + final
   Twilio status (does NOT set the human disposition — see §6).
2. Still write the `deal_activities` row **only when the target has a deal**, so
   the deal timeline stays complete; Jobber-client dials live only in
   `call_attempts` (no deal to attach to).

## 6. Disposition model

Two distinct things, deliberately separated:
- **Twilio status** (`completed`, `no-answer`, `busy`, `failed`) — set by the
  webhook automatically, fills `duration_sec`.
- **Human disposition** (`call_outcome`) — chosen by the rep on the dialer screen
  after hanging up. This is the field call lists/reporting key off. The rep's
  choice updates both the `call_attempts.outcome` and the `call_list_items`
  (`status` → `called`/`done`, `last_outcome`, `attempts++`).

`callback_scheduled` captures a `callback_at` datetime; Phase 1 surfaces these as a
"Callbacks due" filtered view of the rep's items (no auto-redial — that's cadence
territory, deferred).

## 7. UI (`/sales/dialer`)

### Index — `/sales/dialer`
Call lists (team-wide, with a "My lists" toggle) each showing a progress bar
("12 / 40 called") and status; a "New list" action (name + description, then add
people). Built from `getCallLists()` + per-list progress counts.

### Active dialer — `/sales/dialer/[listId]`
The working screen, one person at a time:
- **Person card:** name, company, phone, stage/segment (contacts) or balance
  (clients), last activity, and a link to their deal/record.
- **Call** button (big). Phase 1 copy makes the bridge flow explicit ("Your phone
  will ring first, then we connect them").
- **Disposition bar** (the 8 `call_outcome` buttons) + a note field + an optional
  "schedule callback" datetime, then **Next →** advances to the next `pending`
  item. Progress + remaining count always visible.
- **Keyboard shortcuts** for cadence: call, pick outcome (number keys), next.

## 8. How lists get built

- **Manually:** an "Add to call list" action on contact / deal / Jobber-client
  detail pages and in command-palette / list multi-select results → pick or create
  a list.
- **By filter ("Add by filter"):** pull people into a list by deal `stage`
  (e.g. all `lead`-stage), `segment`, `source`, last-contacted date, and — once
  the tags feature ships — **by tag** (`getEntitiesForTag('sales_contact', tagId)`).
  Phase 1 starts with manual + stage/segment/source; the tag filter is a small
  add-on after tags lands.

## 9. Out of scope for Phase 1 (YAGNI)

Multi-day cadences and auto-scheduled multi-channel steps, auto-SMS/auto-email
touches, voicemail-drop, predictive/parallel dialing, local-presence number pools,
call recording/transcription, a separate raw-"leads" inbox distinct from contacts.
All can layer on later; none require reworking the three core tables.

## 10. Build checklist (one item end-to-end at a time)

1. Migration: 4 enums + `call_lists` + `call_list_items` + `call_attempts` +
   indexes + RLS → `db push` → `typegen` → `typecheck`. Add aliases to
   `db-helpers.types.ts`.
2. Refactor `startCall` → `placeBridgeCall` (deal-optional) without breaking the
   existing deal call button; add `placeCall({ callListItemId })`.
3. Extend `voice-status` webhook to match `call_attempts` by `call_sid`.
4. Server layer `src/lib/dialer/` (queries: lists, items, progress; actions:
   create list, add items, set disposition, advance).
5. Dialer index page.
6. Active dialer screen + keyboard shortcuts.
7. "Add to call list" entry points (detail pages + multi-select) and "Add by
   filter" (stage/segment/source; tag filter once tags ship).
