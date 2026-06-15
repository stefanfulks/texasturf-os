/**
 * POST /api/twilio/sms-inbound
 *
 * Inbound SMS webhook. Twilio POSTs the message (From, Body, MessageSid…); we
 * match the From number to a `sales_contacts.phone`, find that contact's
 * most-recent OPEN deal, and log an inbound `deal_activities` row so the reply
 * shows in the deal's SMS thread.
 *
 * Unmatched numbers (no contact, or no open deal) → log nothing, return an
 * empty TwiML <Response/> (we don't auto-reply). No user session → service
 * client (same as the Jobber/Slack webhooks).
 *
 * Public URL → X-Twilio-Signature validated. Unconfigured → empty TwiML 200.
 * Invalid signature → 403, nothing logged.
 */

import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { validateTwilioRequest, twimlResponse } from "@/lib/twilio/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const OPEN_STAGES = [
  "lead",
  "qualified",
  "site_visit",
  "quote_sent",
  "negotiation",
] as const;

export async function POST(req: Request): Promise<Response> {
  const check = await validateTwilioRequest(req, "/api/twilio/sms-inbound");
  if (check.state === "unconfigured") {
    return twimlResponse(EMPTY_TWIML);
  }
  if (check.state === "invalid") {
    return new Response("invalid signature", { status: 403 });
  }

  const { params } = check;
  const from = params.From?.trim();
  const body = params.Body ?? "";
  const messageSid = params.MessageSid ?? params.SmsSid ?? null;

  if (!from) return twimlResponse(EMPTY_TWIML);

  try {
    const sb = createServiceClient();

    // 1. Match the sender to a sales contact by phone.
    const { data: contact } = await sb
      .from("sales_contacts")
      .select("id")
      .eq("phone", from)
      .maybeSingle();

    const contactId = (contact as { id: string } | null)?.id ?? null;
    if (!contactId) return twimlResponse(EMPTY_TWIML); // unmatched → no-op

    // 2. That contact's most-recent OPEN deal.
    const { data: deal } = await sb
      .from("deals")
      .select("id")
      .eq("sales_contact_id", contactId)
      .in("stage", OPEN_STAGES as unknown as string[])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const dealId = (deal as { id: string } | null)?.id ?? null;
    if (!dealId) return twimlResponse(EMPTY_TWIML); // no open deal → no-op

    // 3. Log the inbound message to the deal timeline.
    await sb.from("deal_activities").insert({
      deal_id: dealId,
      kind: "sms",
      direction: "inbound",
      body,
      metadata: { messageSid, from },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { webhook: "twilio", route: "sms-inbound" },
      extra: { from, messageSid },
    });
  }

  // Never auto-reply — empty TwiML.
  return twimlResponse(EMPTY_TWIML);
}
