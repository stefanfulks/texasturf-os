/**
 * POST /api/twilio/voice-inbound
 *
 * Inbound call entry point — Twilio fetches TwiML here. We look up the caller
 * against sales_contacts; if matched and the deal's owner has a mobile, return
 * a <Dial> that bridges them. The Dial's <Number statusCallback> points at
 * the existing voice-status route with direction=inbound so the answered call
 * still logs to the deal timeline. If Dial doesn't connect (timeout/busy/no
 * answer) execution falls through to the same <Say><Record> voicemail TwiML
 * we use for unmatched callers.
 *
 * No user session — service client, signed request. Public URL → signature
 * validated. Unconfigured → empty TwiML. Invalid signature → 403.
 */

import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { validateTwilioRequest, twimlResponse } from "@/lib/twilio/webhook";
import { twilioPhoneNumber, twilioWebhookUrl } from "@/lib/twilio/client";
import { lookupInboundCaller } from "@/lib/twilio/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICEMAIL_GREETING =
  "Thanks for calling TexasTurf. We can't take your call right now — please leave a short message after the tone and we'll call you back today.";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function voicemailFragment(): string {
  const action = escapeXml(twilioWebhookUrl("/api/twilio/voice-vmail"));
  return [
    `<Say>${escapeXml(VOICEMAIL_GREETING)}</Say>`,
    `<Record maxLength="60" transcribe="true" action="${action}" method="POST" finishOnKey="#" playBeep="true"/>`,
  ].join("");
}

export async function POST(req: Request): Promise<Response> {
  const check = await validateTwilioRequest(req, "/api/twilio/voice-inbound");
  if (check.state === "unconfigured") return twimlResponse(EMPTY_TWIML);
  if (check.state === "invalid") return new Response("invalid signature", { status: 403 });

  const { params } = check;
  const from = params.From?.trim();
  if (!from) {
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${voicemailFragment()}</Response>`);
  }

  try {
    const sb = createServiceClient();
    const lookup = await lookupInboundCaller(sb, from);

    if (lookup.matched && lookup.deal && lookup.ownerMobile) {
      const callerId = twilioPhoneNumber() ?? "";
      const statusCb = escapeXml(
        twilioWebhookUrl(`/api/twilio/voice-status?dealId=${encodeURIComponent(lookup.deal.id)}&direction=inbound`),
      );
      const dialNumber = escapeXml(lookup.ownerMobile);
      const callerAttr = callerId ? ` callerId="${escapeXml(callerId)}"` : "";
      // Dial first; if it doesn't connect, fall through to voicemail in same Response.
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<Response>",
        `<Dial timeout="25"${callerAttr}>`,
        `<Number statusCallback="${statusCb}" statusCallbackEvent="completed" statusCallbackMethod="POST">${dialNumber}</Number>`,
        "</Dial>",
        voicemailFragment(),
        "</Response>",
      ].join("");
      return twimlResponse(xml);
    }

    // Unmatched, or matched-without-owner-mobile → straight to voicemail.
    return twimlResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response>${voicemailFragment()}</Response>`,
    );
  } catch (err) {
    Sentry.captureException(err, {
      tags: { webhook: "twilio", route: "voice-inbound" },
      extra: { from },
    });
    // Always give Twilio valid TwiML — bounce to voicemail on internal error.
    return twimlResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response>${voicemailFragment()}</Response>`,
    );
  }
}
