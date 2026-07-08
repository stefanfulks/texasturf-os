/**
 * Content registry — the source of truth for every editable copy block in the
 * app. Each block ships with its CURRENT text as the in-code `default`, so the
 * app renders identically until someone edits it in /admin/content (which
 * stores only the override in `content_blocks`).
 *
 * To make a new piece of copy editable:
 *   1. Add a block here (stable key + group + label + default).
 *   2. In the page, render `text(cm, "the.key")` (single line) or
 *      <RichText text={text(cm, "the.key")} /> (multi-line, supports **bold**).
 * Both the page and the editor update automatically.
 *
 * Rich text: a blank line separates paragraphs; within a line, **wrap** makes
 * bold. `list: true` blocks render one bullet per line.
 */

export type ContentBlock = {
  key: string;
  /** Editor grouping — usually the page. */
  group: string;
  /** Human label in the editor. */
  label: string;
  default: string;
  /** Renders as a multi-line textarea (prose) vs a single-line input. */
  multiline?: boolean;
  /** Hint shown under the field in the editor. */
  help?: string;
};

export const CONTENT_BLOCKS: ContentBlock[] = [
  // ── Marketing · Organic Growth ──────────────────────────────────────────────────
  { key: "mkt.playbook.title", group: "Marketing · Organic Growth", label: "Page title", default: "Organic Growth" },
  {
    key: "mkt.playbook.sub", group: "Marketing · Organic Growth", label: "Page subtitle", multiline: true,
    default: "The plan everyone follows. Calls run in Reevo, sends go out via Jobber, the record lives here.",
  },
  { key: "mkt.playbook.thesis.eyebrow", group: "Marketing · Organic Growth", label: "Thesis — eyebrow", default: "The system in one line" },
  {
    key: "mkt.playbook.thesis.body", group: "Marketing · Organic Growth", label: "Thesis — body", multiline: true,
    help: "Wrap text in **double asterisks** to bold it.",
    default:
      "We grow through **past clients (referrals)**, **all 13 service lines** (not just turf), and **content** (Troy's videos + field POV). TexasTurf isn't a turf company — it's an outdoor construction company. One crew relationship, thirteen capabilities.",
  },

  { key: "mkt.playbook.referral.title", group: "Marketing · Organic Growth", label: "Referral section — title", default: "Referral program — the Thank-You Blitz" },
  {
    key: "mkt.playbook.referral.bullets", group: "Marketing · Organic Growth", label: "Referral section — bullets", multiline: true,
    help: "One bullet per line. **Bold** with double asterisks.",
    default:
      "**Reward (referrer's choice):** $250 Visa gift card or 1 year of the TexasTurf Care Plan free.\n**Referred friend:** $100 off their project.\n**Earned when:** the referred job is completed and the final invoice is paid.\n**Uncapped, never expires.** B2B partners (pool builders, designers) get reciprocal terms, not gift cards.\n**Care Plan** = annual deep-clean + groom, seam/edge inspection w/ minor repairs, drainage check, pet-odor treatment, priority scheduling, 10% off other work. Never call it “insurance.”",
  },

  { key: "mkt.playbook.cadence.title", group: "Marketing · Organic Growth", label: "Content cadence — title", default: "Content cadence — the accountability loop" },
  {
    key: "mkt.playbook.cadence.body", group: "Marketing · Organic Growth", label: "Content cadence — body", multiline: true,
    help: "Blank line = new paragraph. **Bold** with double asterisks.",
    default:
      "**Troy — 1 long YouTube video / week (publishes Friday)**\n**Mon** — pick topic + outline/script\n**Wed** — film (piggyback on an active job site)\n**Thu** — hand to editor\n**Fri** — publish + log it in Content\n\n**Max — 2–3 POV clips / week (Meta glasses)**\nExcavator cab, loading trucks, seam work, timelapses. The raw views engine. Drop into the Content library.\n\n**Every crew — per job**\n1 before walkthrough, 1 process clip, 1 after reveal. Foreman checklist item; lands in the library.",
  },

  { key: "mkt.playbook.troy.title", group: "Marketing · Organic Growth", label: "Troy calendar — title", default: "Troy — 12-week starter calendar" },
  { key: "mkt.playbook.spotlight.title", group: "Marketing · Organic Growth", label: "Spotlight calendar — title", default: "12-month service spotlight calendar" },
  {
    key: "mkt.playbook.spotlight.intro", group: "Marketing · Organic Growth", label: "Spotlight calendar — intro", multiline: true,
    default: "One service line per month. Each ships the same kit: Jobber email + Troy long video + 4–6 shorts + before/after set + SEO post + yard-sign/social CTA swap.",
  },

  { key: "mkt.playbook.wherethings.title", group: "Marketing · Organic Growth", label: "Where things live — title", default: "Where things live" },
  {
    key: "mkt.playbook.wherethings.bullets", group: "Marketing · Organic Growth", label: "Where things live — bullets", multiline: true,
    help: "One bullet per line. **Bold** with double asterisks.",
    default:
      "**Reevo** — outbound calls + sequences (the referral dialer).\n**Jobber** — client-facing emails + passive referral links.\n**This app** — the record: roster, ledger, campaign briefs/copy, content pipeline + library.\n**Google Drive** — master video/photo files. **YouTube** — publishing. **This app** holds the links + small voice memos.",
  },
];

export const CONTENT_BY_KEY: Map<string, ContentBlock> = new Map(
  CONTENT_BLOCKS.map((b) => [b.key, b]),
);

/** Registry blocks grouped by `group`, preserving declaration order. */
export function contentGroups(): { group: string; blocks: ContentBlock[] }[] {
  const order: string[] = [];
  const byGroup = new Map<string, ContentBlock[]>();
  for (const b of CONTENT_BLOCKS) {
    if (!byGroup.has(b.group)) {
      byGroup.set(b.group, []);
      order.push(b.group);
    }
    byGroup.get(b.group)!.push(b);
  }
  return order.map((group) => ({ group, blocks: byGroup.get(group)! }));
}
