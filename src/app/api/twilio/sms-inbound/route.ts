/**
 * POST /api/twilio/sms-inbound
 *
 * Inbound SMS webhook. Match From → sales_contacts → most-recent open deal,
 * insert deal_activities (inbound sms), then fan out to deal owner (in-app
 * bell) + Slack (#sales-comms via SLACK_SALES_CHANNEL_ID).
 *
 * Unmatched numbers (no contact, or no open deal) → log nothing, return empty
 * TwiML (we don't auto-reply). Public URL → signature validated. Unconfigured
 * → empty TwiML 200. Invalid signature → 403.
 */

import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { validateTwilioRequest, twimlResponse } from "@/lib/twilio/webhook";
import { notifyInboundActivity } from "@/lib/twilio/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';
const OPEN_STAGES = [
  "lead", "qualified", "site_visit", "quote_sent", "negotiation",
] as const;

export async function POST(req: Request): Promise<Response> {
  const check = await validateTwilioRequest(req, "/api/twilio/sms-inbound");
  if (check.state === "unconfigured") return twimlResponse(EMPTY_TWIML);
  if (check.state === "invalid") return new Response("invalid signature", { status: 403 });

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
      .select("id, name")
      .eq("phone", from)
      .maybeSingle();

    const contactRow = contact as { id: string; name: string } | null;
    if (!contactRow) return twimlResponse(EMPTY_TWIML);

    // 2. That contact's most-recent OPEN deal.
    const { data: deal } = await sb
      .from("deals")
      .select("id, name, owner_id")
      .eq("sales_contact_id", contactRow.id)
      .in("stage", OPEN_STAGES as unknown as string[])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const dealRow = deal as { id: string; name: string; owner_id: string | null } | null;
    if (!dealRow) return twimlResponse(EMPTY_TWIML);

    // 3. Log the inbound message to the deal timeline.
    await sb.from("deal_activities").insert({
      deal_id: dealRow.id,
      kind: "sms",
      direction: "inbound",
      body,
      metadata: { messageSid, from },
    });

    // 4. Fan out: in-app notification + Slack.
    await notifyInboundActivity(sb, {
      kind: "sms",
      ownerId: dealRow.owner_id,
      dealId: dealRow.id,
      dealName: dealRow.name,
      contactName: contactRow.name,
      fromNumber: from,
      summary: body,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { webhook: "twilio", route: "sms-inbound" },
      extra: { from, messageSid },
    });
  }

  return twimlResponse(EMPTY_TWIML);
}
