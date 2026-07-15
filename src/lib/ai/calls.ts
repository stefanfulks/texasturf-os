/**
 * Call-review AI (calling suite Phase 3) — one structured review per recorded
 * call, both brands. Same AiResult pattern as lib/ai/marketing.ts (structured
 * parse via zodOutputFormat), but persisted to call_ai_reviews by the caller
 * (lib/calls/pipeline.ts) rather than marketing_ai_generations.
 *
 * Server-only: runs inside the recording webhook pipeline, never client-side.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CALL_REVIEW_SYSTEM_PROMPT } from "@/lib/calls/review-prompt";

// Pinned per the 2026-07-15 build prompt.
export const CALL_REVIEW_MODEL = "claude-sonnet-5";

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "provider_missing" | "generation_failed"; message: string };

const callReviewSchema = z.object({
  summary: z
    .string()
    .describe("2-4 sentences, plain English: what happened and where this relationship stands now"),
  outcome_class: z.enum([
    "connected_interested",
    "connected_not_interested",
    "callback_requested",
    "voicemail",
    "wrong_number",
    "no_decision",
  ]),
  interest_level: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("1 = hard no / do-not-call, 5 = ready to buy or book"),
  objections: z.array(
    z.object({
      objection: z.string(),
      quote: z.string().describe("the customer's actual words, shortened"),
    }),
  ),
  commitments: z.array(
    z.object({
      who: z.enum(["rep", "customer"]),
      commitment: z.string(),
      quote: z.string(),
    }),
  ),
  follow_up_actions: z.array(
    z.object({
      title: z.string().describe('imperative, e.g. "Send trade pricing sheet to Mike at GreenScape"'),
      description: z.string(),
      due_in_days: z.number().int().min(0),
      priority: z.enum(["low", "medium", "high"]),
    }),
  ),
  coaching_notes: z
    .array(z.string())
    .describe("1-3 bullets for the rep — specific, kind, tied to quotes"),
});

export type CallReview = z.infer<typeof callReviewSchema>;

export type CallReviewMeta = {
  brand: string;
  repName: string | null;
  contactName: string | null;
  contactCompany: string | null;
  listContext: string | null;
  priorOutcomes: string | null;
};

export async function reviewCallTranscript(
  transcript: string,
  meta: CallReviewMeta,
): Promise<AiResult<{ review: CallReview; tokensInput: number; tokensOutput: number }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "provider_missing",
      message: "AI provider not configured — ANTHROPIC_API_KEY is not set.",
    };
  }
  const client = new Anthropic({ apiKey });

  const userPrompt = [
    `Brand: ${meta.brand}`,
    `Rep: ${meta.repName ?? "unknown"}`,
    `Contact: ${meta.contactName ?? "unknown"}${meta.contactCompany ? ` (${meta.contactCompany})` : ""}`,
    meta.listContext ? `Call list context: ${meta.listContext}` : null,
    meta.priorOutcomes ? `Prior outcome history: ${meta.priorOutcomes}` : null,
    "",
    "Transcript:",
    transcript,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  try {
    const response = await client.messages.parse({
      model: CALL_REVIEW_MODEL,
      max_tokens: 4000,
      system: CALL_REVIEW_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: zodOutputFormat(callReviewSchema) },
    });
    if (!response.parsed_output) {
      return {
        ok: false,
        error: "generation_failed",
        message: "The model returned no structured output.",
      };
    }
    return {
      ok: true,
      data: {
        review: response.parsed_output,
        tokensInput: response.usage.input_tokens,
        tokensOutput: response.usage.output_tokens,
      },
    };
  } catch (err) {
    return { ok: false, error: "generation_failed", message: describeAnthropicError(err) };
  }
}

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
