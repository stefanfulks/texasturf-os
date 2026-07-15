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
  twilioMessagingServiceSid,
  isSmsConfigured,
} from "@/lib/twilio/client";
import { placeBridgeCall } from "@/lib/twilio/bridge";
import { getValidGoogleAccessToken } from "@/lib/google/tokens";
import { sendGmail, type SendError } from "@/lib/google/gmail";

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
 * Start a bridge-style call from a deal: Twilio rings the rep's phone first,
 * then on answer dials the lead and bridges them, so the lead sees the
 * TexasTurf caller ID. The mechanics live in placeBridgeCall (shared with the
 * power dialer); dealId rides on the status callback so completion logs to
 * the right deal timeline.
 */
export async function startCall(
  dealId: string,
  contactId: string,
): Promise<CommResult> {
  const contact = await getContact(contactId);
  const leadPhone = contact?.phone?.trim();
  if (!leadPhone) {
    return {
      ok: false,
      reason: "Add a phone number to this contact to call.",
    };
  }

  const result = await placeBridgeCall({
    toPhone: leadPhone,
    statusCallbackPath: `/api/twilio/voice-status?dealId=${encodeURIComponent(dealId)}`,
  });
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
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

/**
 * Send an outbound email to the lead from the rep's own Gmail, and log it to
 * the deal timeline. Uses the existing Google OAuth refresh tokens stored in
 * google_oauth_tokens (set up for Calendar; we just added the gmail.send scope
 * in login/actions.ts). Existing users get the new scope on next sign-in
 * (prompt=consent), and the typed `scope_missing` error tells them so.
 */
export async function sendEmailFromDeal(
  dealId: string,
  contactId: string,
  subject: string,
  body: string,
): Promise<CommResult> {
  const subj = subject.trim();
  const text = body.trim();
  if (!subj) return { ok: false, reason: "Add a subject line." };
  if (!text) return { ok: false, reason: "Write a message first." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Sign in first." };

  // From = the signed-in user's own profile (their Gmail address).
  const { data: profile } = (await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle()) as unknown as {
    data: { full_name: string | null; email: string | null } | null;
  };
  const fromName = profile?.full_name?.trim() || "TexasTurf";
  const fromEmail = profile?.email?.trim() || user.email;
  if (!fromEmail) {
    return { ok: false, reason: "Your account is missing an email." };
  }

  const contact = await getContact(contactId);
  const toEmail = contact?.email?.trim();
  if (!toEmail) {
    return {
      ok: false,
      reason: "Add an email to this contact before sending.",
    };
  }

  const tokenStatus = await getValidGoogleAccessToken(user.id);
  if (!tokenStatus.ok) {
    return {
      ok: false,
      reason:
        tokenStatus.reason === "no_tokens"
          ? "Sign in with Google to enable Gmail send."
          : "Couldn't authorize Gmail — try signing in again.",
    };
  }

  try {
    const sent = await sendGmail(tokenStatus.accessToken, {
      to: toEmail,
      fromName,
      fromEmail,
      subject: subj,
      body: text,
    });

    const sb = await salesDb();
    await sb.from("deal_activities").insert({
      deal_id: dealId,
      kind: "email",
      direction: "outbound",
      // Store subject + body so the timeline shows the full thing on review.
      body: `Subject: ${subj}\n\n${text}`,
      metadata: {
        gmailMessageId: sent.id,
        gmailThreadId: sent.threadId,
        toEmail,
        fromEmail,
      },
      created_by: user.id,
    });

    revalidatePath(`/sales/deals/${dealId}`);
    return { ok: true };
  } catch (err) {
    const sendErr = err as SendError;
    if (sendErr?.kind === "scope_missing") {
      return {
        ok: false,
        reason:
          "Gmail send permission not granted — sign out + sign in again to enable it.",
      };
    }
    if (sendErr?.kind === "auth_failed") {
      return { ok: false, reason: "Your Google session expired — sign in again." };
    }
    Sentry.captureException(err, {
      tags: { feature: "sales-comms", action: "sendEmail" },
      extra: { dealId, contactId },
    });
    return { ok: false, reason: "Couldn't send the email — try again." };
  }
}

