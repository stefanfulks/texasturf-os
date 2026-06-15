# Sales Comms (Calling + SMS) — Design Spec

**Date:** 2026-06-15
**Status:** Approved by Stefan (chat, 2026-06-15) — both channels, calling first; he's setting up a fresh Twilio account in parallel.
**What it is:** Phase 2 of the Sales module. Click-to-call a lead from a deal and 2-way SMS, all logged to the `deal_activities` timeline that phase 1 already built (`kind in ('call','sms')`, `direction`, `metadata`). Twilio is the provider. Calling ships as soon as the number is live (no 10DLC); SMS switches on when A2P 10DLC clears.

## Goals

- A rep can call a lead from the deal page; the call is logged (duration, outcome) to the deal timeline automatically, with the TexasTurf number as caller ID.
- A rep can text a lead from the deal page; replies appear as a thread on the deal; every message is logged.
- Zero new data model — reuse `deal_activities`. Contacts carry the phone number (`sales_contacts.phone`).

## Non-goals (v1)

- No browser softphone (WebRTC) — bridge to the rep's existing phone instead. Field crews aren't at a desk.
- No IVR/phone menus, no call recording, no voicemail transcription, no MMS, no bulk/campaign SMS. (Recording + transcription are good phase-3 candidates.)
- No porting an existing TexasTurf line in v1 — a fresh Twilio number (decided with Stefan).

## Architecture

**Credentials (env, server-only, never in chat — AGENTS.md §3):**
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (E.164, the purchased number), and later `TWILIO_MESSAGING_SERVICE_SID` (the 10DLC-registered messaging service for SMS). Documented in `.env.example`. Added to Vercel (`printf '%s' "<v>" | vercel env add NAME production`) + `.env.local`. When unset, the call/text UI renders a disabled "Twilio not configured" state — the app never crashes.

**`src/lib/twilio/client.ts`** — server-only factory returning a configured Twilio client, or `null` when env is missing (callers guard on null). Package: `pnpm add twilio`.

**Calling — "bridge" style:**
- Server action `startCall(dealId, contactId)`: looks up the lead's phone (`sales_contacts.phone`) and the rep's mobile (the signed-in user's `profiles.mobile`), then creates a Twilio call to the **rep** whose TwiML `<Dial callerId="<TWILIO_PHONE_NUMBER>">` connects to the **lead**. Result: the rep's phone rings; on answer, the lead is dialed and bridged; the lead sees the TexasTurf number.
- `POST /api/twilio/voice-twiml` — returns the `<Response><Dial callerId=…><Number>…</Number></Dial></Response>` TwiML for the bridge.
- `POST /api/twilio/voice-status` — Twilio status callback; on completion inserts `deal_activities` (`kind='call'`, `direction='outbound'`, `body` = human summary, `metadata` = `{callSid, durationSec, status}`).
- **Rep mobile:** requires the rep's cell. If `profiles` has no phone column, add one additive migration `profiles.mobile text`. The deal page passes the signed-in user; v1 falls back to a configurable `TWILIO_FALLBACK_REP_NUMBER` if the profile has none.

**SMS (enabled when 10DLC clears):**
- Server action `sendSms(dealId, contactId, body)`: sends via the messaging service (`TWILIO_MESSAGING_SERVICE_SID`) to the lead, logs `deal_activities` (`kind='sms'`, `direction='outbound'`, `metadata={messageSid}`).
- `POST /api/twilio/sms-inbound` — inbound webhook: validate signature, match the `From` number to a `sales_contacts.phone` → its most-recent open deal, insert inbound `deal_activities` (`direction='inbound'`), optionally notify the deal owner. Unmatched numbers log to a catch-all/no-op with a flag.
- Deal page **SMS thread**: reads `deal_activities where kind='sms'` for the deal, renders a simple thread + composer. Composer disabled with a "texting goes live when 10DLC is approved" note until `TWILIO_MESSAGING_SERVICE_SID` is set.

**Security:** all three webhook routes validate `X-Twilio-Signature` via `twilio.validateRequest(authToken, signature, url, params)` and reject otherwise — they're public URLs, so this is mandatory. Credentials are server-only; the browser never sees them.

**Deal page UI:** a **Call** button (calling) and a **Text** panel (SMS) on the deal, both keyed off `sales_contacts.phone` — so a deal with no phone shows "add a phone number to call/text." Reuses texasturf-os tokens; the call/text history is just the existing activity timeline filtered by kind.

## Data flow

Outbound call → `startCall` → Twilio dials rep → TwiML bridges lead → `voice-status` webhook → `deal_activities` row → shows on deal timeline.
Inbound text → Twilio → `sms-inbound` webhook (signature-checked) → match contact → `deal_activities` row → shows in deal SMS thread.

## Phasing

- **2a — Calling.** Ships the moment Stefan's number is live + creds are in env. No 10DLC.
- **2b — SMS.** Code ships dark (composer disabled) with 2a; switches on by setting `TWILIO_MESSAGING_SERVICE_SID` once 10DLC is approved.

## Error handling

- Missing/blank env → features disabled, no crash.
- `startCall`/`sendSms` with no contact phone → returns a clear "no phone on file" result the UI surfaces; no Twilio call made.
- Twilio API errors → caught, surfaced to the rep ("couldn't place the call — try again"), and captured to Sentry.
- Webhook signature mismatch → 403, nothing logged.

## Verification (definition of done)

- **Static (now):** `pnpm typecheck`, `pnpm lint`, `pnpm build` exit 0; the routes/actions build with env unset (disabled state).
- **Live (when Stefan's number + creds exist):** a real test **call** bridges and logs to a deal (the `/integrate` "real receipt" gate). A real test **SMS** round-trips once 10DLC is approved. Neither is claimed done without the real event.

## Cost (Stefan-owned)

Twilio number ~$1.15/mo; A2P 10DLC ~$4/mo brand+campaign; per-minute voice + per-message SMS usage (pennies). Set up under his own Twilio account.

## Build order (for the plan)

1. `pnpm add twilio`; `.env.example` + env guards; `src/lib/twilio/client.ts`.
2. `profiles.mobile` additive migration (if absent) for the bridge target.
3. Calling: `startCall` action, `voice-twiml` + `voice-status` routes (signature-validated), deal-page Call button, status→activity logging.
4. SMS (dark): `sendSms` action, `sms-inbound` route, deal-page SMS thread + disabled composer.
5. Static verify; wire creds + real test call when the number's live; flip SMS on at 10DLC approval.
