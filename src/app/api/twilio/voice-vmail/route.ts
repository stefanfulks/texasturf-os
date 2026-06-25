/**
 * POST /api/twilio/voice-vmail
 *
 * Twilio's <Record action="..."> callback after a caller leaves a voicemail.
 * Body carries RecordingUrl, RecordingSid, RecordingDuration, From, plus
 * TranscriptionText/Status when transcribe="true" (Twilio transcription is
 * async — usually arrives in this same callback for short recordings; if not,
 * we log without transcript and the audio link still works).
 *
 * Logic:
 *   - Match `From` against sales_contacts (reuse lookupInboundCaller).
 *   - Matched + deal → insert deal_activities (kind 'call', direction 'inbound',
 *     body = transcript or "Voicemail (Xs)", metadata = {recordingSid, recordingUrl,
 *     durationSec, transcript, isVoicemail:true}).
 *   - Unmatched (or matched-with-no-deal) → insert unmatched_calls row.
 *   - Either way → fire notifyInboundActivity for owner + Slack fan-out.
 *
 * Always return empty TwiML so the call ends cleanly.
 */

import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { validateTwilioRequest, twimlResponse } from "@/lib/twilio/webhook";
import { lookupInboundCaller } from "@/lib/twilio/inbound";
import { notifyInboundActivity } from "@/lib/twilio/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

export async function POST(req: Request): Promise<Response> {
  const check = await validateTwilioRequest(req, "/api/twilio/voice-vmail");
  if (check.state === "unconfigured") return twimlResponse(EMPTY_TWIML);
  if (check.state === "invalid") return new Response("invalid signature", { status: 403 });

  const { params } = check;
  const from = params.From?.trim() ?? "";
  const recordingUrl = params.RecordingUrl ?? null;
  const recordingSid = params.RecordingSid ?? null;
  const durationSec = Number.parseInt(params.RecordingDuration ?? "0", 10) || 0;
  const transcript = params.TranscriptionText?.trim() || null;

  try {
    const sb = createServiceClient();
    const lookup = await lookupInboundCaller(sb, from);

    const body = transcript ?? `Voicemail (${durationSec}s)`;
    const metadata = { recordingSid, recordingUrl, durationSec, transcript, isVoicemail: true };

    if (lookup.matched && lookup.deal) {
      await sb.from("deal_activities").insert({
        deal_id: lookup.deal.id,
        kind: "call",
        direction: "inbound",
        body,
        metadata,
      });
      await notifyInboundActivity(sb, {
        kind: "voicemail",
        ownerId: lookup.deal.ownerId,
        dealId: lookup.deal.id,
        dealName: lookup.deal.name,
        contactName: lookup.contact.name,
        fromNumber: from,
        summary: transcript ?? `(no transcript — ${durationSec}s recording)`,
      });
    } else {
      await sb.from("unmatched_calls").insert({
        from_number: from,
        recording_url: recordingUrl,
        recording_sid: recordingSid,
        duration_sec: durationSec,
        transcript,
      });
      await notifyInboundActivity(sb, {
        kind: "voicemail",
        ownerId: null,
        dealId: null,
        dealName: null,
        contactName: null,
        fromNumber: from,
        summary: transcript ?? `(no transcript — ${durationSec}s recording)`,
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { webhook: "twilio", route: "voice-vmail" },
      extra: { from, recordingSid },
    });
    // Always 200 — don't make Twilio retry-storm.
  }

  return twimlResponse(EMPTY_TWIML);
}
