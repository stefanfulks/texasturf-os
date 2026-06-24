// Slack helpers for the Vendor Purchasing module: the daily digest to
// #vendor-order-status and buyer DMs for time-based nudges. Reuses the shared
// bot helpers (openDM / lookupUserByEmail) from ./slack.

import { openDM, lookupUserByEmail } from "./slack";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";

export type SlackBlock = Record<string, unknown>;

/** Post a Block Kit message to a channel. Returns ok + ts (or an error code). */
export async function postBlocks(
  channel: string,
  text: string,
  blocks: SlackBlock[],
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  if (!SLACK_BOT_TOKEN) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel, text, blocks, unfurl_links: false }),
    });
    const data = (await res.json()) as { ok: boolean; ts?: string; error?: string };
    return data;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** DM a TexasTurf user (resolved by email → Slack id). Best-effort. */
export async function dmUserByEmail(email: string, text: string): Promise<boolean> {
  const lookup = await lookupUserByEmail(email);
  if (!lookup.ok) return false;
  const dm = await openDM(lookup.user.id);
  if (!dm.ok) return false;
  if (!SLACK_BOT_TOKEN) return false;
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: dm.channel.id, text }),
    });
    const data = (await res.json()) as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
}

export function orderUrl(id: string): string {
  return `${APP_URL}/operations/vendor-orders/${id}`;
}

// ── Digest block builder ──────────────────────────────────────────────────────

export type DigestLine = { id: string; text: string };
export type DigestSection = { heading: string; emoji: string; lines: DigestLine[] };

function section(s: DigestSection): SlackBlock[] {
  if (s.lines.length === 0) return [];
  const body = s.lines
    .map((l) => `• ${l.text}  <${orderUrl(l.id)}|open>`)
    .join("\n");
  return [
    { type: "section", text: { type: "mrkdwn", text: `*${s.emoji} ${s.heading}*  _(${s.lines.length})_\n${body}` } },
  ];
}

/**
 * Build the morning digest. `overdue` is rendered first and boldest. Returns a
 * blocks array ready for postBlocks, plus a plain-text fallback.
 */
export function buildDigestBlocks(sections: {
  overdue: DigestLine[];
  needsOrdering: DigestLine[];
  waitingOnVendor: DigestLine[];
  inTransit: DigestLine[];
  upcomingPayments: DigestLine[];
}): { text: string; blocks: SlackBlock[] } {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const blocks: SlackBlock[] = [
    { type: "header", text: { type: "plain_text", text: `Vendor Orders — ${today}`, emoji: true } },
  ];

  const total =
    sections.overdue.length + sections.needsOrdering.length + sections.waitingOnVendor.length +
    sections.inTransit.length + sections.upcomingPayments.length;

  if (total === 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "✅ Nothing needs attention today. All vendor orders are on track." } });
    return { text: "Vendor Orders: all clear today", blocks };
  }

  blocks.push(...section({ heading: "Overdue — needs attention", emoji: "🚨", lines: sections.overdue }));
  if (sections.overdue.length) blocks.push({ type: "divider" });
  blocks.push(...section({ heading: "Needs Ordering", emoji: "📝", lines: sections.needsOrdering }));
  blocks.push(...section({ heading: "Waiting on Vendor", emoji: "⏳", lines: sections.waitingOnVendor }));
  blocks.push(...section({ heading: "In Transit", emoji: "🚚", lines: sections.inTransit }));
  blocks.push(...section({ heading: "Upcoming Payments (next 7 days)", emoji: "💵", lines: sections.upcomingPayments }));

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `<${APP_URL}/operations/vendor-orders|Open Vendor Orders →>` }],
  });

  return { text: `Vendor Orders digest — ${total} item${total === 1 ? "" : "s"} need attention`, blocks };
}
