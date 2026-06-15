/**
 * POST /api/twilio/voice-status?dealId=<uuid>
 *
 * Twilio's call status callback (statusCallbackEvent=['completed']). On a
 * completed call we log a `deal_activities` row (kind='call',
 * direction='outbound') with the duration + status in metadata, so the call
 * shows on the deal timeline.
 *
 * No user session here (it's a server-to-server webhook), so we use the
 * service-role client — same pattern as the Jobber/Slack webhooks. The signed
 * URL carries the dealId, so it can't be tampered with.
 *
 * Public URL → X-Twilio-Signature validated. Unconfigured → 200 no-op.
 * Invalid signature → 403, nothing logged.
 */

import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { validateTwilioRequest } from "@/lib/twilio/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "0s";
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export async function POST(req: Request): Promise<Response> {
  const check = await validateTwilioRequest(req, "/api/twilio/voice-status");
  if (check.state === "unconfigured") {
    return new Response("ok", { status: 200 });
  }
  if (check.state === "invalid") {
    return new Response("invalid signature", { status: 403 });
  }

  const { params } = check;
  const dealId = new URL(req.url).searchParams.get("dealId");
  const status = params.CallStatus ?? "";

  // Only log terminal/completed calls (we subscribe to 'completed', but guard
  // anyway so an unexpected event doesn't create a noise row).
  if (status !== "completed" || !dealId) {
    return new Response("ok", { status: 200 });
  }

  const durationSec = Number.parseInt(params.CallDuration ?? "0", 10) || 0;
  const callSid = params.CallSid ?? null;

  try {
    const sb = createServiceClient();
    await sb.from("deal_activities").insert({
      deal_id: dealId,
      kind: "call",
      direction: "outbound",
      body: `Call — ${formatDuration(durationSec)} (${status})`,
      metadata: { callSid, durationSec, status },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { webhook: "twilio", route: "voice-status" },
      extra: { dealId, callSid, status },
    });
    // Still 200 so Twilio doesn't retry-storm; the error is captured.
  }

  return new Response("ok", { status: 200 });
}
