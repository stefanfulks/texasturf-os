import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  twilioClient,
  twilioPhoneNumber,
  twilioWebhookUrl,
  isTwilioConfigured,
} from "@/lib/twilio/client";

/**
 * The low-level bridge-call primitive (dialer spec §4): Twilio rings the
 * signed-in rep's phone first, then on answer dials the target and bridges
 * them, so the target sees the TexasTurf caller ID. Deal-optional — Jobber
 * clients and TurfCasa customers work too. `startCall` (deal button) and the
 * dialer's `placeCall` both come through here; the Phase-2 softphone swap
 * replaces only this function's body.
 */

export type BridgeCallResult =
  | { ok: true; callSid: string }
  | { ok: false; reason: string };

/**
 * The number Twilio bridges the call through: the signed-in rep's own mobile
 * (profiles.mobile, set on Settings → Account), falling back to the shared env
 * number when the rep hasn't set one.
 */
export async function currentRepNumber(): Promise<string> {
  const envFallback = process.env.TWILIO_FALLBACK_REP_NUMBER ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return envFallback;
  const { data } = await supabase
    .from("profiles")
    .select("mobile")
    .eq("id", user.id)
    .maybeSingle();
  const mobile = (data as { mobile: string | null } | null)?.mobile?.trim();
  return mobile || envFallback;
}

export async function placeBridgeCall(args: {
  toPhone: string;
  /** Full status-callback path incl. query string, e.g.
   * `/api/twilio/voice-status?dealId=…` — params are part of the signed URL. */
  statusCallbackPath: string;
}): Promise<BridgeCallResult> {
  if (!isTwilioConfigured()) {
    return { ok: false, reason: "Twilio isn't set up yet." };
  }
  const client = twilioClient();
  const fromNumber = twilioPhoneNumber();
  if (!client || !fromNumber) {
    return { ok: false, reason: "Twilio isn't set up yet." };
  }

  const repNumber = await currentRepNumber();
  if (!repNumber) {
    return {
      ok: false,
      reason: "Add your mobile on Settings → Account so calls can ring your phone.",
    };
  }

  const toPhone = args.toPhone.trim();
  if (!toPhone) {
    return { ok: false, reason: "No phone number on this record." };
  }

  try {
    // Rep is dialed first; on answer Twilio fetches voice-twiml, which
    // bridges to the target with the TexasTurf caller ID.
    const call = await client.calls.create({
      to: repNumber,
      from: fromNumber,
      url: twilioWebhookUrl(`/api/twilio/voice-twiml?to=${encodeURIComponent(toPhone)}`),
      statusCallback: twilioWebhookUrl(args.statusCallbackPath),
      statusCallbackEvent: ["completed"],
    });
    return { ok: true, callSid: call.sid };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: "twilio", action: "placeBridgeCall" },
    });
    return { ok: false, reason: "Couldn't place the call — try again." };
  }
}
