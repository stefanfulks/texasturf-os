/**
 * POST /api/twilio/voice-twiml?to=<lead E.164>
 *
 * Twilio fetches this when the rep's phone is answered on a bridge-style call
 * (see placeBridgeCall). It returns TwiML that <Dial>s the lead with the
 * TexasTurf number as caller ID, connecting the two parties.
 *
 * Calling suite Phase 2: the <Dial> records the bridged conversation
 * (dual-channel, from answer) and reports recording lifecycle to
 * /api/twilio/recording-status. When the record_announcement setting is ON
 * (default), the customer leg gets a whisper ("this call may be recorded")
 * via the <Number url> before being bridged.
 *
 * Public URL → X-Twilio-Signature is validated (the `to` param is part of the
 * signed URL, so it can't be tampered with). Unconfigured (no auth token) →
 * 200 no-op. Invalid signature → 403.
 */

import * as Sentry from "@sentry/nextjs";
import { twilioPhoneNumber, twilioWebhookUrl } from "@/lib/twilio/client";
import { validateTwilioRequest, twimlResponse } from "@/lib/twilio/webhook";
import { createServiceClient } from "@/lib/supabase/service";
import { getRecordAnnouncement } from "@/lib/calls/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// XML-escape the caller-ID/number before interpolating into TwiML.
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: Request): Promise<Response> {
  const check = await validateTwilioRequest(req, "/api/twilio/voice-twiml");
  if (check.state === "unconfigured") {
    // Nothing configured — return a benign hangup rather than 403.
    return twimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  }
  if (check.state === "invalid") {
    return new Response("invalid signature", { status: 403 });
  }

  const callerId = twilioPhoneNumber();
  const to = new URL(req.url).searchParams.get("to")?.trim();

  if (!callerId || !to) {
    // Misconfigured or missing target — hang up cleanly.
    return twimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  }

  // Recording-announcement toggle (default ON — fail safe if unreadable).
  let announce = true;
  try {
    announce = await getRecordAnnouncement(createServiceClient());
  } catch (err) {
    Sentry.captureException(err, { tags: { webhook: "twilio", route: "voice-twiml" } });
  }

  const recordingCallback = xmlEscape(twilioWebhookUrl("/api/twilio/recording-status"));
  const whisperUrl = xmlEscape(twilioWebhookUrl("/api/twilio/voice-whisper"));
  const numberAttrs = announce ? ` url="${whisperUrl}"` : "";

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<Response>" +
    `<Dial callerId="${xmlEscape(callerId)}"` +
    ' record="record-from-answer-dual"' +
    ` recordingStatusCallback="${recordingCallback}"` +
    ' recordingStatusCallbackEvent="completed absent"' +
    ">" +
    `<Number${numberAttrs}>${xmlEscape(to)}</Number>` +
    "</Dial>" +
    "</Response>";

  return twimlResponse(xml);
}
