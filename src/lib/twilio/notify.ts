/**
 * Fan-out for inbound sales comms (SMS reply, voicemail). Two destinations:
 *   1. In-app: insert a `notifications` row for the deal owner (skipped if no
 *      ownerId — no one to notify).
 *   2. Slack: post to SLACK_SALES_CHANNEL_ID (skipped when unset).
 *
 * Pure relative to the supplied Supabase client (so tests inject a mock).
 * Errors don't throw — caller is a webhook that must always 200 to Twilio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { postMessage as slackPostMessage } from "@/lib/integrations/slack";
import { slackSalesChannelId } from "./client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";

export type InboundKind = "sms" | "voicemail";

export interface InboundActivityArgs {
  kind: InboundKind;
  ownerId: string | null;
  dealId: string | null;
  dealName: string | null;
  contactName: string | null;
  /** Inbound caller's E.164 number (used in unmatched Slack copy). */
  fromNumber?: string;
  /** Short message body / voicemail transcript. */
  summary: string;
}

const KIND_LABEL: Record<InboundKind, string> = {
  sms: "text",
  voicemail: "voicemail",
};

const NOTIFICATION_TYPE: Record<InboundKind, string> = {
  sms: "sales_inbound_sms",
  voicemail: "sales_inbound_voicemail",
};

export async function notifyInboundActivity(
  sb: SupabaseClient,
  args: InboundActivityArgs,
): Promise<void> {
  const { kind, ownerId, dealId, dealName, contactName, fromNumber, summary } = args;
  const matched = Boolean(dealId);
  const label = KIND_LABEL[kind];

  // 1. In-app notification — owner only, only for matched activity.
  if (matched && ownerId && dealId && dealName) {
    try {
      await sb.from("notifications").insert({
        user_id: ownerId,
        type: NOTIFICATION_TYPE[kind],
        title: `New ${label} from ${contactName ?? "a contact"} on ${dealName}`,
        body: truncate(summary, 280),
        resource_type: "deal",
        resource_id: dealId,
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: "sales-comms-notify", surface: "in_app" },
        extra: { kind, ownerId, dealId },
      });
    }
  }

  // 2. Slack — only when configured.
  const channel = slackSalesChannelId();
  if (!channel) return;

  const text = matched
    ? `New ${label} from ${contactName ?? "a contact"} on *${dealName}* — ${truncate(summary, 280)}\n${APP_URL}/sales/deals/${dealId}`
    : `Unmatched ${label} from ${fromNumber ?? "unknown"} — needs triage. ${truncate(summary, 240)}\n${APP_URL}/sales/inbox`;

  try {
    const res = await slackPostMessage(channel, text);
    if (!res.ok) {
      Sentry.captureMessage(`sales-comms Slack post failed: ${res.code}`, {
        tags: { feature: "sales-comms-notify", surface: "slack" },
        extra: { code: res.code, detail: res.detail, kind, dealId },
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: "sales-comms-notify", surface: "slack" },
      extra: { kind, dealId, fromNumber },
    });
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}
