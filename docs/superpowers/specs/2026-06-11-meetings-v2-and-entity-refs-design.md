# Meetings v2 + Cross-App Entity References — Design

**Date:** 2026-06-11 · **Author:** Claude (autonomous session for Stefan)
**Request:** Auto Google Meet links (copyable), one-time meetings, invite by role/department/person, cross-app tagging of tasks/projects/invoices/clients (e.g. reference the Hillman invoice in an agenda line item), fix the no-spaces input in the agenda flow.

## Ship order (one item per commit, verified between)

1. Fix no-spaces friction (auto-slug from meeting name)
2. Entity reference system (#refs) + meetings agenda wiring
3. #refs in task comments
4. Migration: `once` cadence, `scheduled_on`, `invited_user_ids`, `meet_url`, `gcal_event_id`, RLS update
5. One-time meetings UI
6. Invite by person (role/department already exists)
7. Google Meet auto-link + copy + calendar invites

## 1. No-spaces fix

The only spaces-rejecting input in the meetings flow is the URL-slug field on
`/meetings/new` (`pattern="[a-z0-9-]+"` + zod `/^[a-z0-9-]+$/`). Users type a
name like "Sales Huddle" and get blocked. Fix: the slug auto-derives from the
name as you type (spaces→dashes, lowercased, deduped); the field stays visible
and editable but sanitizes input live instead of rejecting it. Duplicate-slug
inserts (Postgres 23505) return a friendly message instead of a raw constraint
error. Server zod stays as the backstop. Agenda *section* names and agenda
*item* titles/bodies already accept spaces — no change needed there.

## 2–3. Entity references

**Format (stored inline in text):** `#[Label](type:id)` — e.g.
`#[Hillman — INV 1042](invoice:3f2a…)`. Self-contained (survives markdown
export), unambiguous (id travels with the label), renderable anywhere.

- `src/lib/refs.ts` — types (`task | project | invoice | client`), `REF_ROUTES`
  (task→/tasks/:id, project→/jobs/:id, invoice→/invoices/:id,
  client→/clients?q= since clients have no detail page), `parseRefs`,
  `serializeRef`, `stripRefMarkup` (plain-text degrade), markdown renderer.
- `src/app/(app)/_actions/search-entities.ts` — one server action, user-context
  Supabase client (RLS applies), queries the four entities with ilike on their
  display columns (modeled on Turfy's search tools), returns
  `{type, id, label, sublabel}` capped per type.
- `src/components/refs/ref-input.tsx` — controlled textarea/input; typing `#`
  opens an autocomplete (debounced searchEntities, arrow/enter/escape,
  mouse-down select). Inserts the full `#[Label](type:id)` token.
- `src/components/refs/ref-text.tsx` — renders text, turning ref tokens into
  link chips; everything else passes through (incl. existing @mention
  highlight where wired).
- Wiring: meeting item modal (title + details), agenda item rows, agenda
  markdown export (refs → real markdown links); task comments (alongside the
  existing @people mentions, which keep their uuid[] + trigger notification
  path untouched).

RLS note: a chip may point at an entity the viewer can't open — the target
page 404s/redirects per its own RLS, which is the intended behavior; search
results are always RLS-filtered for the person typing.

## 4–6. One-time meetings + invitees

- Enum: `alter type meeting_cadence add value 'once'` (own migration — new
  enum values can't be used in the same transaction).
- Columns: `scheduled_on date` (the one date a `once` meeting happens),
  `invited_user_ids uuid[] default '{}'`, `meet_url text`,
  `gcal_event_id text`.
- `user_can_see_meeting()` gains `or auth.uid() = any(m.invited_user_ids)` —
  invited people see the meeting regardless of role/department.
- Cadence helpers: `once` occurrence = `scheduled_on`; no prev/next stepping;
  list + detail show the concrete date; carry-forward hidden for `once`.
- Form: cadence tile "One-time" reveals a date input; People picker (chips,
  from profiles) fills `invited_user_ids`.

## 7. Google Meet

- `createEvent` in `src/lib/google/calendar.ts` gains optional
  `withMeet` (adds `conferenceData.createRequest` + `?conferenceDataVersion=1`
  + random requestId), `recurrence` (RRULE built from cadence:
  daily/weekly/biweekly/monthly), `attendees` already supported. Returns
  `hangoutLink`/`conferenceData` entry point.
- On meeting create: resolve attendee emails = explicitly invited users ∪
  role-matched ∪ department-matched profiles (open-to-everyone meetings invite
  only the creator + explicit invitees — no company-wide blast). Create the
  event with the creator's stored token (`getValidGoogleAccessToken`), save
  `meet_url` + `gcal_event_id`. Failure or no Google connection NEVER blocks
  meeting creation — the meeting saves, UI shows "no Meet link" state and a
  manual link field.
- Detail page header: "Join Google Meet" button + copy-link icon button
  (clipboard with fallback). Meetings list shows a video icon when a link
  exists.
- Known limitation (accepted): archiving a meeting doesn't delete the Google
  event (event lives on the creator's calendar; archiver's token can't touch
  it). No meeting-edit UI exists today, so no event-sync-on-edit either.

## Out of scope (follow-ups)

- Meeting edit UI (and gcal event sync on edit/archive).
- Refs in project notes / invoice comments (component is reusable; wire later).
- Standalone Meet links for `adhoc` cadence (needs Meet REST API scope we
  don't request yet).
