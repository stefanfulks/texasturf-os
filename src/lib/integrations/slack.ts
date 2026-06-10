import type { IntegrationResult } from "./types";
import type { Invoice, InvoiceStatus } from "@/lib/db-helpers.types";

const SLACK_BOT_TOKEN   = process.env.SLACK_BOT_TOKEN;
const DEFAULT_CHANNEL   = process.env.SLACK_INVOICE_CHANNEL_ID ?? "#invoices";
const APP_URL           = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";

const STATUS_EMOJI: Partial<Record<InvoiceStatus, string>> = {
  submitted:          "📄",
  awaiting_review:    "🔍",
  awaiting_approval:  "⏳",
  approved:           "✅",
  request_change:     "✏️",
  rejected:           "❌",
  paid:               "💵",
  on_hold:            "🔒",
};

function buildInvoiceBlocks(invoice: Invoice & { vendorName?: string }, event: string) {
  const vendorName  = invoice.vendorName ?? "Unknown Vendor";
  const amount      = invoice.total_amount != null
    ? `$${invoice.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : "Amount TBD";
  const link        = `${APP_URL}/invoices/${invoice.id}`;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${event}*\n*<${link}|${invoice.title}>*`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Vendor:*\n${vendorName}` },
        { type: "mrkdwn", text: `*Amount:*\n${amount}` },
        ...(invoice.service_period_start
          ? [{ type: "mrkdwn" as const, text: `*Service Period:*\n${invoice.service_period_start}${invoice.service_period_end ? ` – ${invoice.service_period_end}` : ""}` }]
          : []),
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Invoice" },
          url: link,
          style: "primary",
        },
      ],
    },
  ];
}

// ─── General-purpose helpers ────────────────────────────────────────────────

/**
 * Discriminated result for the helpers below. `ok: true` carries any data
 * the caller needs; `ok: false` carries a stable error code plus the raw
 * Slack error string for debugging.
 */
export type SlackHelperResult<T extends object = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; code: SlackErrorCode; detail?: string };

export type SlackErrorCode =
  | "not_configured"   // SLACK_BOT_TOKEN missing
  | "missing_scope"    // Slack: app's bot token lacks the required OAuth scope
  | "not_found"        // user/channel doesn't exist
  | "api_error"        // any other Slack API error
  | "fetch_failed";    // network/transport failure

type SlackApiResponse<T extends object = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error?: string; needed?: string };

async function slackFetch<T extends object = Record<string, never>>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<SlackHelperResult<T>> {
  if (!SLACK_BOT_TOKEN) {
    return { ok: false, code: "not_configured" };
  }
  let data: SlackApiResponse<T>;
  try {
    const res = await fetch(`https://slack.com/api/${endpoint}`, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type":  "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    data = (await res.json()) as SlackApiResponse<T>;
  } catch (err) {
    return { ok: false, code: "fetch_failed", detail: err instanceof Error ? err.message : String(err) };
  }
  if (data.ok) return data;

  const err = data.error ?? "unknown";
  let code: SlackErrorCode = "api_error";
  if (err === "missing_scope")     code = "missing_scope";
  if (err === "users_not_found")   code = "not_found";
  if (err === "channel_not_found") code = "not_found";
  return { ok: false, code, detail: data.needed ? `${err} (needs scope: ${data.needed})` : err };
}

/**
 * Post a plain text message to a Slack channel or DM. The `channel` can be:
 *   - a channel name like "#general"
 *   - a channel ID like "C012ABCD"
 *   - a DM channel ID like "D012ABCD" (obtained from openDM)
 */
export async function postMessage(
  channel: string,
  text: string,
): Promise<SlackHelperResult<{ ts: string }>> {
  return slackFetch<{ ts: string }>("chat.postMessage", { channel, text });
}

/**
 * Resolve an email to a Slack user ID via users.lookupByEmail. Requires
 * the bot to have the `users:read.email` scope.
 */
export async function lookupUserByEmail(
  email: string,
): Promise<SlackHelperResult<{ user: { id: string; name?: string; real_name?: string } }>> {
  if (!SLACK_BOT_TOKEN) return { ok: false, code: "not_configured" };
  const params = new URLSearchParams({ email });
  let data: SlackApiResponse<{ user: { id: string; name?: string; real_name?: string } }>;
  try {
    const res = await fetch(`https://slack.com/api/users.lookupByEmail?${params.toString()}`, {
      headers: { "Authorization": `Bearer ${SLACK_BOT_TOKEN}` },
    });
    data = (await res.json()) as typeof data;
  } catch (err) {
    return { ok: false, code: "fetch_failed", detail: err instanceof Error ? err.message : String(err) };
  }
  if (data.ok) return data;
  const err = data.error ?? "unknown";
  let code: SlackErrorCode = "api_error";
  if (err === "missing_scope")   code = "missing_scope";
  if (err === "users_not_found") code = "not_found";
  return { ok: false, code, detail: data.needed ? `${err} (needs scope: ${data.needed})` : err };
}

/**
 * Open (or reopen — idempotent) a DM channel with a Slack user. Returns
 * the channel ID to use with postMessage. Requires `im:write` scope.
 */
export async function openDM(
  slackUserId: string,
): Promise<SlackHelperResult<{ channel: { id: string } }>> {
  return slackFetch<{ channel: { id: string } }>("conversations.open", { users: slackUserId });
}

export async function sendInvoiceNotification(
  invoice: Invoice & { vendorName?: string },
  event: string,
  channel?: string,
): Promise<IntegrationResult> {
  const targetChannel = channel ?? DEFAULT_CHANNEL;

  if (!SLACK_BOT_TOKEN) {
    console.log(`[Slack mock] ${event}: ${invoice.title} → ${targetChannel}`);
    return { success: true, message: "Slack not configured — logged only" };
  }

  try {
    const emoji   = STATUS_EMOJI[invoice.status] ?? "📋";
    const text    = `${emoji} ${event}: ${invoice.title}`;
    const blocks  = buildInvoiceBlocks(invoice, event);

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ channel: targetChannel, text, blocks }),
    });

    const data = await res.json() as { ok: boolean; ts?: string; error?: string };

    if (!data.ok) {
      return { success: false, error: data.error ?? "Unknown Slack error" };
    }

    return { success: true, externalId: data.ts, message: "Sent to Slack" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

