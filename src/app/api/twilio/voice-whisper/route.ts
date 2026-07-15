/**
 * POST /api/twilio/voice-whisper
 *
 * The <Number url> whisper on bridge calls (calling suite Phase 2): played to
 * the CUSTOMER leg only, right before they're bridged to the rep. Carries the
 * recording announcement — Texas is one-party consent, but out-of-state
 * callees may not be, so the toggle defaults ON (see call_settings).
 *
 * Public URL → signature validated. Unconfigured → benign empty TwiML.
 * Invalid signature → 403.
 */

import { validateTwilioRequest, twimlResponse } from "@/lib/twilio/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const check = await validateTwilioRequest(req, "/api/twilio/voice-whisper");
  if (check.state === "unconfigured") {
    return twimlResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  }
  if (check.state === "invalid") {
    return new Response("invalid signature", { status: 403 });
  }

  return twimlResponse(
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response><Say voice="alice">This call may be recorded for quality purposes.</Say></Response>',
  );
}
