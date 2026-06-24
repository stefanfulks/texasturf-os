# Sales Comms — Inbound Routing + Notifications (Phase 3a)

**Date:** 2026-06-23
**Status:** Approved by Stefan (chat, 2026-06-23). Slack channel `#sales-comms` created on his side.
**What it is:** Phase 3a of the Sales comms work. Phase 2 shipped outbound calling (bridge-style, per-rep mobile) and SMS code (dormant until 10DLC). This sub-project closes the inbound side: someone ringing the TexasTurf number reaches a human or a captured voicemail; inbound texts actually notify the right people.

## Goal

Eliminate dead air on the live TexasTurf Twilio number. Specifically:
1. **Matched callers** (known sales contacts) get routed to their deal owner's mobile.
2. **Unmatched or unanswered calls** go to a short voicemail that is recorded, transcribed, and surfaced to the office.
3. **Inbound texts** (now and when 10DLC clears) notify the deal owner in-app + Slack and post to `#sales-comms`.

## Non-goals (deferred)

- After-hours greeting variation → Phase 3c (AI receptionist).
- Office-cell fallback chain (owner → office → round-robin) → Phase 3b (multi-rep call surface).
- Browser softphone → Phase 3b.
- AI greeting / qualifying / booking → Phase 3c.
- Routing inbound from existing Jobber clients into this pipeline → future. v1 looks up `sales_contacts.phone` only; Jobber clients hit voicemail/unmatched, keeping the surfaces from blurring (Jobber handles their client comms).
- Outbound AI calls → Phase 3d.

## Architecture

```
Inbound call to +15129817983
  └─ Twilio → POST /api/twilio/voice-inbound (signature-validated)
       └─ Match `From` against sales_contacts.phone
           ├─ matched + owner has profiles.mobile
           │    └─ TwiML: <Dial timeout=25 callerId=$TWILIO_PHONE_NUMBER>
           │              <Number statusCallback=/api/twilio/voice-status?dealId=…&direction=inbound
           │                      statusCallbackEvent=completed>{owner_mobile}</Number>
           │            </Dial><Say>{greeting}</Say><Record …same as below…>
           │            ├─ owner picks up → bridged to lead → on hangup the Number's status
           │            │  callback fires → existing /api/twilio/voice-status logs an
           │            │  inbound call row to the deal (direction=inbound, body shows
           │            │  duration). The Record is skipped because Dial connected.
           │            └─ owner misses (timeout / busy / no answer) → Dial returns control
           │               → Say + Record run → voicemail path below
           └─ unmatched OR Dial fell through
                └─ TwiML: <Say>{greeting}</Say><Record maxLength=60 transcribe=true
                          action=/api/twilio/voice-vmail/>
                     └─ Twilio fires /api/twilio/voice-vmail with recording + transcript
                          ├─ matched contact → insert deal_activities (inbound voicemail)
                          └─ unmatched → insert unmatched_calls row

Inbound SMS to +15129817983
  └─ Twilio → POST /api/twilio/sms-inbound (already exists)
       └─ existing insert into deal_activities
       └─ NEW fan-out:
            ├─ notifications row for deal owner (in-app bell)
            └─ Slack post to #sales-comms (via SLACK_SALES_CHANNEL_ID)
       (Same fan-out applies to inbound voicemail rows.)
```

## Data model

**One new table** (additive, RLS like the rest of sales):
```sql
create table public.unmatched_calls (
  id              uuid primary key default gen_random_uuid(),
  from_number     text not null,
  recording_url   text,
  recording_sid   text,
  duration_sec    integer,
  transcript      text,
  occurred_at     timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users(id),
  resolution_note text
);
create index unmatched_calls_occurred_idx on public.unmatched_calls(occurred_at desc);
create index unmatched_calls_open_idx     on public.unmatched_calls(occurred_at desc) where resolved_at is null;
alter table public.unmatched_calls enable row level security;
create policy unmatched_calls_authd on public.unmatched_calls for all to authenticated using (true) with check (true);
```
Reuses `profiles.mobile`, `deal_activities`, the existing `notifications` module, and the existing Slack lib.

## Code surface

| File | Role |
| --- | --- |
| `src/lib/twilio/inbound.ts` | Pure lookup: phone → matched contact → open deal → owner profile (incl. mobile). Vitest-covered. |
| `src/lib/twilio/notify.ts` | Fan-out helper: given an inbound activity (call or sms) + matched deal/owner → insert `notifications` row + Slack post. Vitest-covered. |
| `src/app/api/twilio/voice-inbound/route.ts` | NEW. Validates signature. Looks up; returns dial-owner TwiML or voicemail TwiML. |
| `src/app/api/twilio/voice-vmail/route.ts` | NEW. Validates signature. Receives recording + transcript; matched → `deal_activities` + notify; unmatched → `unmatched_calls`. |
| `src/app/api/twilio/voice-status/route.ts` | MODIFY. Accept a `direction` query param. When `direction=inbound`, log the activity as inbound (currently always outbound). Also call the new `notify.ts` fan-out for inbound answered calls so owner+Slack get pinged. |
| `src/app/api/twilio/sms-inbound/route.ts` | MODIFY. After existing insert, call the new `notify.ts` fan-out. |
| `src/app/(app)/sales/inbox/page.tsx` | NEW sub-page on Sales. Two sections: Unmatched calls (open by default) + Recent inbound activity. Office triages from here. |
| `src/components/sales/UnmatchedCallsTable.tsx` | NEW client component. Plays recording (HTML5 audio against signed Twilio recording URL), shows transcript, "Resolve / convert to deal" action. |
| `src/app/(app)/sales/inbox/actions.ts` | NEW server actions: `resolveUnmatched(id, note)`, `convertUnmatchedToDeal(id, contactInput)`. |
| `src/components/nav-links.tsx` | MODIFY. Add an "Inbox" link to the sales department nav set. |
| `.env.example` | MODIFY. Document `SLACK_SALES_CHANNEL_ID` and the new `/api/twilio/voice-inbound` + `/api/twilio/voice-vmail` URLs. |

## Greeting copy (v1, plain Twilio `<Say>`)

> *"Thanks for calling TexasTurf. We can't take your call right now — please leave a short message after the tone and we'll call you back today."*

Two sentences, neutral voice. Phase 3c (AI receptionist) replaces this with a real conversation; this is the v1 stopgap.

## Notification policy

For inbound SMS and voicemail, when the activity matches a deal:
- **Owner** → `notifications` row ("New text from {contact} on {deal}" / "Voicemail from {contact} on {deal}") deep-linked to the deal page. Renders in the existing in-app bell.
- **`#sales-comms`** → Slack message with contact name, deal name, snippet of message/transcript, link to the deal in the app. If `SLACK_SALES_CHANNEL_ID` is unset, this step is a graceful no-op.

For inbound activity without a deal match (cold caller voicemail):
- **`#sales-comms`** → Slack message "Unmatched voicemail from {from_number} — needs triage" with transcript + link to `/sales/inbox`.

No notifications fire if `SLACK_SALES_CHANNEL_ID` is unset and there is no matched owner.

## Twilio Console setup (Stefan, one-time)

On the `+15129817983` number's Voice config:
- **A call comes in** → Webhook → `https://os.texasturfusa.com/api/twilio/voice-inbound` (HTTP POST)
- Leave the existing SMS webhook (`/api/twilio/sms-inbound`) as-is.

## Phase split inside 3a (ship in this order)

1. **Migration + lookup module + notify module** (with vitest). No webhook yet.
2. **voice-inbound + voice-vmail webhooks** + Stefan adds the Voice webhook URL in Twilio Console.
3. **SMS notify** wiring (already-built insert + the new fan-out).
4. **`/sales/inbox`** UI + nav link.
5. **Verify** (gates + real test calls + Slack receipt).

## Verification (definition of done)

- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` all exit 0 — output shown.
- **Real test 1 — matched routing:** call TexasTurf number from sister's verified number → Stefan's mobile rings → he picks up → bridged → hang up → call row appears in Mercer deal timeline.
- **Real test 2 — voicemail (unmatched):** call from a different verified-but-unknown number → reaches voicemail → Stefan records a short message → row appears in `/sales/inbox` with transcript + audio playable + Slack post in `#sales-comms`.
- **Real test 3 — SMS fan-out (deferred behind 10DLC, not blocking 3a):** inbound text → deal owner's in-app bell pings + Slack post to `#sales-comms`.

## Stefan's to-do alongside this build

1. Tell me the `#sales-comms` channel ID (Slack → channel → "View channel details" → bottom of the popup; starts with `C…`). I'll add it as `SLACK_SALES_CHANNEL_ID` to Vercel env, never to chat. Or you can add it via `vercel env add SLACK_SALES_CHANNEL_ID production` from terminal yourself.
2. After step 2 of the build ships, paste the `/api/twilio/voice-inbound` URL into the number's Voice webhook config in Twilio Console.
