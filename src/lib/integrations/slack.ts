import type { IntegrationResult } from "./types";
import type { Invoice, InvoiceStatus } from "@/lib/database.types";

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

