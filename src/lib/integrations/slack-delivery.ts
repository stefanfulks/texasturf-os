/**
 * Slack delivery confirmation poster.
 *
 * Posts a formatted "delivery confirmed" message to the configured warehouse
 * channel. Mirrors the structure of slack.ts:sendInvoiceNotification but for
 * warehouse_deliveries rows.
 *
 * Env vars:
 *   SLACK_BOT_TOKEN              (shared) — bot OAuth token
 *   SLACK_WAREHOUSE_CHANNEL_ID   — target channel for delivery confirmations
 *                                  (falls back to "#warehouse" if unset)
 *   NEXT_PUBLIC_APP_URL          (shared) — for building the deep link
 */

import type { IntegrationResult } from "./types";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const DEFAULT_CHANNEL = process.env.SLACK_WAREHOUSE_CHANNEL_ID ?? "#warehouse";
const APP_URL         = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";

export type DeliveryMaterials = {
  turf?:      { product?: string | null; sqft?: number | null; batch?: string | null };
  dg?:        { cubic_yards?: number | null };
  infill?:    { type?: string | null; bags?: number | null };
  fasteners?: { nails_boxes?: number | null; staples_boxes?: number | null };
};

export type DeliverySlackPayload = {
  id:                string;
  client_name:       string | null;
  address:           string | null;
  delivered_at:      string;
  received_by:       string | null;
  staging_location:  string | null;
  notes:             string | null;
  photo_url:         string | null;
  materials:         DeliveryMaterials;
};

function fmtSqft(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} sqft`;
}

function buildMaterialsLines(m: DeliveryMaterials): string[] {
  const lines: string[] = [];
  if (m.turf) {
    const bits = [
      m.turf.product,
      fmtSqft(m.turf.sqft ?? null),
      m.turf.batch ? `batch ${m.turf.batch}` : null,
    ].filter(Boolean);
    if (bits.length > 0) lines.push(`*Turf:* ${bits.join(" · ")}`);
  }
  if (m.dg && m.dg.cubic_yards != null) {
    lines.push(`*DG:* ${m.dg.cubic_yards} cu yd`);
  }
  if (m.infill && (m.infill.type || m.infill.bags != null)) {
    const bits = [m.infill.type, m.infill.bags != null ? `${m.infill.bags} bags` : null].filter(Boolean);
    lines.push(`*Infill:* ${bits.join(" · ")}`);
  }
  if (m.fasteners) {
    const bits: string[] = [];
    if (m.fasteners.nails_boxes)   bits.push(`${m.fasteners.nails_boxes} boxes nails`);
    if (m.fasteners.staples_boxes) bits.push(`${m.fasteners.staples_boxes} boxes staples`);
    if (bits.length > 0) lines.push(`*Fasteners:* ${bits.join(" · ")}`);
  }
  return lines;
}

function buildBlocks(d: DeliverySlackPayload) {
  const link = `${APP_URL}/operations/deliveries/${d.id}`;
  const when = new Date(d.delivered_at).toLocaleString("en-US", {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    hour:    "numeric",
    minute:  "2-digit",
  });

  const headerLines: string[] = [
    `*Delivery confirmed* — <${link}|${d.client_name ?? "(no client)"}>`,
    `🕒 ${when}`,
  ];
  if (d.address) headerLines.push(`📍 ${d.address}`);
  if (d.staging_location) headerLines.push(`🏗 staged at ${d.staging_location}`);
  if (d.received_by) headerLines.push(`✅ received by ${d.received_by}`);

  const materialsLines = buildMaterialsLines(d.materials);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: headerLines.join("\n") },
    },
  ];
  if (materialsLines.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: materialsLines.join("\n") },
    });
  }
  if (d.notes && d.notes.trim().length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `📝 ${d.notes.trim()}` },
    });
  }
  if (d.photo_url) {
    blocks.push({
      type: "image",
      image_url: d.photo_url,
      alt_text:  "Delivery photo",
    });
  }
  blocks.push({
    type: "actions",
    elements: [
      {
        type:  "button",
        text:  { type: "plain_text", text: "Open in OS" },
        url:   link,
        style: "primary",
      },
    ],
  });
  return blocks;
}

export async function sendDeliveryNotification(
  delivery: DeliverySlackPayload,
  channel?: string,
): Promise<IntegrationResult> {
  const targetChannel = channel ?? DEFAULT_CHANNEL;

  if (!SLACK_BOT_TOKEN) {
    console.log(`[Slack mock] Delivery confirmed: ${delivery.client_name ?? "(no client)"} → ${targetChannel}`);
    return { success: true, message: "Slack not configured — logged only" };
  }

  try {
    const text   = `📦 Delivery confirmed: ${delivery.client_name ?? "(no client)"}`;
    const blocks = buildBlocks(delivery);

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ channel: targetChannel, text, blocks }),
    });

    const data = await res.json() as { ok: boolean; ts?: string; channel?: string; error?: string };

    if (!data.ok) {
      return { success: false, error: data.error ?? "Unknown Slack error" };
    }

    return {
      success:    true,
      externalId: data.ts,
      message:    `Sent to ${data.channel ?? targetChannel}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
