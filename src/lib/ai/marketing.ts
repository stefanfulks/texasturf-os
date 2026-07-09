/**
 * Marketing AI core — structured generation for the Marketing OS.
 *
 * Server-only (imported by server actions; never by client components).
 * Every generator returns a discriminated AiResult so the UI can render the
 * exact provider states the Marketing OS spec requires:
 *   provider_missing  → ANTHROPIC_API_KEY not set; nothing was attempted
 *   generation_failed → the API call or schema parse failed
 *   ok                → validated, schema-conformant output
 *
 * Callers persist results themselves and log every generation to
 * marketing_ai_generations via logAiGeneration(). AI output NEVER invents
 * real business numbers — the system prompt forces bracket placeholders.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

const MODEL = "claude-opus-4-8";

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "provider_missing" | "generation_failed"; message: string };

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// Mirrors the content_items enums (see marketing/content/actions.ts).
// voice_memo is excluded — AI drafts filmable ideas, not audio uploads.
const CONTENT_TYPES = ["long_video", "short", "pov_clip", "before_after", "photo_set", "blog_post", "other"] as const;
const CONTENT_ASSIGNEES = ["warehouse", "ivana", "stefan", "troy"] as const;
const SERVICE_LINES = [
  "turf", "xeriscape", "lot_clearing", "pavers", "tree_removal", "excavation",
  "stone_work", "site_prep", "concrete", "courts", "fencing", "welding", "landscape_design",
] as const;

const SYSTEM_PROMPT = `You are the content strategist for TexasTurf, a Texas outdoor-living company (artificial turf, xeriscape, pavers, concrete, sport courts, fencing, tree removal, excavation, stone work, site prep, welding, landscape design, lot clearing).

You turn rough ideas into filming-ready content cards the team can execute same-day in the field, the warehouse, or the office. Be concrete and practical — a crew member should be able to pick up the card and start filming.

Four filming pillars — pick the assignee that fits:
- warehouse — POV / b-roll from job sites and the yard; no talking required
- ivana — lifestyle, family, and home-aesthetic angle
- stefan — cost/ROI/comparison talking-head and paid ad creative
- troy — educational 101/FAQ and long-form YouTube

Rules:
- Ground everything in real turf-industry field work: crews, equipment, materials, befores and afters. Every shot must be physically filmable on a residential job site, in the warehouse, or in the office.
- hook: the first-3-seconds line, spoken plain English, curiosity or payoff up front.
- script_md: spoken-word talking points or full script in plain English. Markdown allowed (short sections, bold for emphasis).
- shot_list_md: a numbered list; each line is exactly one filmable shot with framing (wide / close / POV / drone).
- b_roll_md: cutaways, timelapses, texture shots to capture while on site.
- props_md: wardrobe, location, equipment, and permissions needed.
- tag: a short 1-3 word card label like "101/FAQ", "Ad Creative", "POV", "Lifestyle", "Before/After".
- NEVER invent real business numbers — no made-up review counts, install counts, prices, discounts, or timelines. If a number would strengthen the script, write a bracket placeholder like [X five-star reviews] or [$X per sq ft] for the owner to fill in.`;

/** Shared generation core: provider check → structured parse → error mapping.
 * Every section generator goes through here so provider states stay uniform. */
async function generate<T>(
  schema: z.ZodType<T>,
  system: string,
  userPrompt: string,
): Promise<AiResult<T>> {
  const client = getClient();
  if (!client) {
    return { ok: false, error: "provider_missing", message: "AI provider not configured — ANTHROPIC_API_KEY is not set." };
  }
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: zodOutputFormat(schema) },
    });
    if (!response.parsed_output) {
      return { ok: false, error: "generation_failed", message: "The model returned no structured output. Try again." };
    }
    return { ok: true, data: response.parsed_output };
  } catch (err) {
    return { ok: false, error: "generation_failed", message: describeAnthropicError(err) };
  }
}

const contentCardSchema = z.object({
  title: z.string().describe("Short, punchy card title (under 80 chars)"),
  tag: z.string().describe("1-3 word card label, e.g. '101/FAQ', 'Ad Creative', 'POV'"),
  assignee: z.enum(CONTENT_ASSIGNEES).describe("Which filming pillar executes this"),
  type: z.enum(CONTENT_TYPES).describe("Content format"),
  service_line: z.enum(SERVICE_LINES).nullable().describe("The service line this promotes, or null if general"),
  hook: z.string().describe("First-3-seconds spoken hook"),
  script_md: z.string().describe("Spoken-word script or talking points, markdown"),
  shot_list_md: z.string().describe("Numbered shot list, one filmable shot per line"),
  b_roll_md: z.string().describe("B-roll to capture on site"),
  props_md: z.string().describe("Props, wardrobe, location, equipment needs"),
});

export type AiContentCard = z.infer<typeof contentCardSchema>;

/** Rough idea in → complete filming-ready content card out. */
export async function generateContentCard(roughIdea: string): Promise<AiResult<AiContentCard>> {
  return generate(
    contentCardSchema,
    SYSTEM_PROMPT,
    `Turn this rough idea into a filming-ready content card:\n\n${roughIdea}`,
  );
}

const contentDetailsSchema = z.object({
  hook: z.string().describe("First-3-seconds spoken hook"),
  script_md: z.string().describe("Spoken-word script or talking points, markdown"),
  shot_list_md: z.string().describe("Numbered shot list, one filmable shot per line"),
  b_roll_md: z.string().describe("B-roll to capture on site"),
  props_md: z.string().describe("Props, wardrobe, location, equipment needs"),
  tag: z.string().describe("1-3 word card label if none exists yet"),
  assignee: z.enum(CONTENT_ASSIGNEES).describe("Suggested filming pillar"),
});

export type AiContentDetails = z.infer<typeof contentDetailsSchema>;

/** Existing card (often just a title) → full play-by-play production detail. */
export async function generateContentDetails(card: {
  title: string;
  type: string | null;
  tag: string | null;
  assignee: string | null;
  service_line: string | null;
  hook: string | null;
}): Promise<AiResult<AiContentDetails>> {
  const known = [
    `Title: ${card.title}`,
    card.type ? `Format: ${card.type}` : null,
    card.tag ? `Tag: ${card.tag}` : null,
    card.assignee ? `Assigned pillar: ${card.assignee} (keep this assignee)` : null,
    card.service_line ? `Service line: ${card.service_line}` : null,
    card.hook ? `Existing hook (build on it): ${card.hook}` : null,
  ].filter(Boolean).join("\n");
  return generate(
    contentDetailsSchema,
    SYSTEM_PROMPT,
    `Write the full production detail for this existing content card:\n\n${known}`,
  );
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

const CAMPAIGN_SYSTEM = `You are the marketing strategist for TexasTurf, a Texas outdoor-living company (artificial turf, xeriscape, pavers, concrete, sport courts, fencing, tree removal, excavation, stone work, site prep, welding, landscape design, lot clearing).

You write tight, executable campaign briefs a two-person marketing team can run this month. No corporate fluff — every field must be specific enough to act on today.

Rules:
- objective: one sentence, measurable where possible, but NEVER invent real business numbers — use bracket placeholders like [X leads/month] where the owner must supply the target.
- audience: who exactly, where (Texas metro homeowners, HOA boards, builders…), and the pain/desire that makes them act.
- offer: the concrete hook customers respond to. If it needs a real discount or price, use a bracket placeholder like [$X off].
- next_action: the single next step the team should take this week, starting with a verb.
- notes: channels, creative angles, and the content the four filming pillars (warehouse POV, ivana lifestyle, stefan ROI/ads, troy educational) should feed into it.`;

const campaignBriefSchema = z.object({
  name: z.string().describe("Short campaign name (under 60 chars)"),
  objective: z.string().describe("One-sentence measurable objective; bracket placeholders for real numbers"),
  audience: z.string().describe("Exactly who + where + the pain/desire"),
  offer: z.string().describe("The concrete offer/hook; bracket placeholders for prices/discounts"),
  next_action: z.string().describe("The single next step this week, starts with a verb"),
  notes: z.string().describe("Channels, creative angles, and how the four filming pillars feed it"),
});

export type AiCampaignBrief = z.infer<typeof campaignBriefSchema>;

/** Rough goal in → executable campaign brief out. */
export async function generateCampaignBrief(roughGoal: string): Promise<AiResult<AiCampaignBrief>> {
  return generate(
    campaignBriefSchema,
    CAMPAIGN_SYSTEM,
    `Draft a campaign brief for this goal:\n\n${roughGoal}`,
  );
}

/** Best-effort audit log — a logging failure must never sink the generation. */
export async function logAiGeneration(
  supabase: SupabaseClient<Database>,
  entry: {
    section: string;
    generation_type: string;
    input: Json;
    output: Json;
    linked_table?: string;
    linked_record_id?: string;
    created_by: string;
  },
): Promise<void> {
  const { error } = await supabase.from("marketing_ai_generations").insert({
    section: entry.section,
    generation_type: entry.generation_type,
    input: entry.input,
    output: entry.output,
    linked_table: entry.linked_table ?? null,
    linked_record_id: entry.linked_record_id ?? null,
    created_by: entry.created_by,
  });
  if (error) {
    console.error("[marketing-ai] failed to log generation:", error.message);
  }
}

/** Map SDK typed errors to a short operator-readable message (most specific first). */
function describeAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "AI provider rejected the API key — check ANTHROPIC_API_KEY.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "AI provider is rate-limited right now — wait a minute and try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Could not reach the AI provider — network issue. Try again.";
  }
  if (err instanceof Anthropic.APIError) {
    return `AI provider error (${err.status ?? "unknown"}): ${err.message}`;
  }
  return err instanceof Error ? err.message : "Unknown AI error.";
}
