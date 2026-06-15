"use server";

/**
 * Sales comms server actions: click-to-call + outbound SMS via Twilio.
 *
 * Both degrade gracefully: when Twilio is unconfigured or the contact has no
 * phone, they return a typed `{ ok: false, reason }` result the UI surfaces —
 * they never throw for the expected "not set up yet" / "no phone" cases. Real
 * Twilio/API failures are caught, captured to Sentry, and returned as a
 * friendly reason (AGENTS.md: errors → Sentry; spec error-handling table).
 *
 * Activity logging reuses the phase-1 `deal_activities` timeline — no new data
 * model. Reads/writes go through the user-context client (salesDb / queries)
 * so RLS applies (AGENTS.md §6).
 */

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { salesDb } from "@/lib/sales/db";
import { getContact } from "@/lib/sales/queries";
import {
  twilioClient,
  twilioPhoneNumber,
  twilioMessagingServiceSid,
  twilioWebhookUrl,
  isTwilioConfigured,
  isSmsConfigured,
} from "@/lib/twilio/client";

export type CommResult = { ok: true } | { ok: false; reason: string };

/** Current signed-in user id (for deal_activities.created_by), or null. */
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Start a bridge-style call: Twilio rings the rep's phone first, then on answer
 * dials the lead and bridges them, so the lead sees the TexasTurf caller ID.
 *
 * The rep number comes from env `TWILIO_FALLBACK_REP_NUMBER`. Per-rep
 * `profiles.mobile` is a future enhancement (kept out of phase 2a to avoid any
 * prod DDL — see the design spec's simplification note).
 */
export async function startCall(
  dealId: string,
  contactId: string,
): Promise<CommResult> {
  if (!isTwilioConfigured()) {
    return { ok: false, reason: "Twilio isn't set up yet." };
  }

  const client = twilioClient();
  const fromNumber = twilioPhoneNumber();
  const repNumber = process.env.TWILIO_FALLBACK_REP_NUMBER ?? "";
  if (!client || !fromNumber) {
    return { ok: false, reason: "Twilio isn't set up yet." };
  }
  if (!repNumber) {
    return {
      ok: false,
      reason: "No rep phone number is configured to bridge the call.",
    };
  }

  const contact = await getContact(contactId);
  const leadPhone = contact?.phone?.trim();
  if (!leadPhone) {
    return {
      ok: false,
      reason: "Add a phone number to this contact to call.",
    };
  }

  try {
    // The rep is dialed first. When they answer, Twilio fetches voice-twiml,
    // which returns a <Dial> that bridges to the lead with the TexasTurf
    // caller ID. dealId rides on the status callback so completion logs to the
    // right deal; the lead's number rides on the twiml URL.
    const voiceUrl = twilioWebhookUrl(
      `/api/twilio/voice-twiml?to=${encodeURIComponent(leadPhone)}`,
    );
    const statusUrl = twilioWebhookUrl(
      `/api/twilio/voice-status?dealId=${encodeURIComponent(dealId)}`,
    );

    await client.calls.create({
      to: repNumber,
      from: fromNumber,
      url: voiceUrl,
      statusCallback: statusUrl,
      statusCallbackEvent: ["completed"],
    });

    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: "sales-comms", action: "startCall" },
      extra: { dealId, contactId },
    });
    return {
      ok: false,
      reason: "Couldn't place the call — try again.",
    };
  }
}

/**
 * Send an outbound SMS to the lead via the 10DLC messaging service, and log it
 * to the deal timeline. Stays dark until `TWILIO_MESSAGING_SERVICE_SID` is set.
 */
export async function sendSms(
  dealId: string,
  contactId: string,
  body: string,
): Promise<CommResult> {
  const text = body.trim();
  if (!text) return { ok: false, reason: "Write a message first." };

  if (!isSmsConfigured()) {
    return {
      ok: false,
      reason: "Texting goes live when 10DLC is approved.",
    };
  }

  const client = twilioClient();
  const messagingServiceSid = twilioMessagingServiceSid();
  if (!client || !messagingServiceSid) {
    return {
      ok: false,
      reason: "Texting goes live when 10DLC is approved.",
    };
  }

  const contact = await getContact(contactId);
  const leadPhone = contact?.phone?.trim();
  if (!leadPhone) {
    return { ok: false, reason: "Add a phone number to this contact to text." };
  }

  try {
    const message = await client.messages.create({
      to: leadPhone,
      messagingServiceSid,
      body: text,
    });

    const sb = await salesDb();
    await sb.from("deal_activities").insert({
      deal_id: dealId,
      kind: "sms",
      direction: "outbound",
      body: text,
      metadata: { messageSid: message.sid },
      created_by: await currentUserId(),
    });

    revalidatePath(`/sales/deals/${dealId}`);
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: "sales-comms", action: "sendSms" },
      extra: { dealId, contactId },
    });
    return { ok: false, reason: "Couldn't send the text — try again." };
  }
}
