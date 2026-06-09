/**
 * Draft action types for Turfy's write tools.
 *
 * A "draft" is the proposed-but-not-yet-committed form of an action that
 * Turfy wants to take. The flow:
 *
 *   1. User asks for something ("add a task to walk Sage Creek tomorrow").
 *   2. Turfy calls a `propose_*` tool → runner resolves names/dates →
 *      returns a Draft envelope (this file's types).
 *   3. The assistant route streams a `tool_draft` SSE event carrying the
 *      draft to the client.
 *   4. The chat UI renders a confirm card. User clicks Confirm → POST to
 *      `/api/assistant/commit-draft` → that endpoint re-validates the draft
 *      against the schemas here and dispatches to the real server action.
 *
 * The kind-discriminated union lets us add more action types (calendar
 * event, Slack message, …) without changing the framework: add a new
 * `Draft<X>Schema`, add it to `DraftSchema`, extend `summarizeDraft`, and
 * handle the case in the commit-draft route.
 */

import { z } from "zod";

// ─── DraftTask ──────────────────────────────────────────────────────────────

export const DraftTaskSchema = z.object({
  kind: z.literal("task"),
  title: z.string().min(1, "Title is required").max(280),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  // Strict ISO date (no time-of-day for tasks — that's the calendar tool's job).
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  // Resolved profile id of the primary assignee. The runner did the name →
  // id lookup before returning the draft. `null` means "assign to the
  // caller" (matches the createTask server action's default).
  assignee_id: z.string().uuid().nullable().default(null),
  // Display name for the assignee — used only to render the confirm card.
  // The commit endpoint re-validates from assignee_id, not this string,
  // so tampering with it has no effect.
  assignee_display: z.string().nullable().default(null),
});

export type DraftTask = z.infer<typeof DraftTaskSchema>;

// ─── DraftCalendarEvent ─────────────────────────────────────────────────────

/**
 * Resolved attendee — email always present (the runner did the name → email
 * lookup before returning the draft). `display` is for the confirm card only.
 */
export const DraftAttendeeSchema = z.object({
  email:   z.string().email(),
  display: z.string().nullable().default(null),
});
export type DraftAttendee = z.infer<typeof DraftAttendeeSchema>;

export const DraftCalendarEventSchema = z.object({
  kind:    z.literal("calendar_event"),
  summary: z.string().min(1, "Event title is required").max(280),
  // Naive local datetime in Central Time. Server attaches the tz
  // (America/Chicago) when calling Google Calendar. Format enforced
  // strictly so the model has to do the natural-language → ISO conversion
  // itself (today's date is in the system prompt).
  start_iso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Start must be YYYY-MM-DDTHH:MM"),
  end_iso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "End must be YYYY-MM-DDTHH:MM"),
  description: z.string().max(2000).optional(),
  location:    z.string().max(500).optional(),
  // Empty array means "just me" — no invites.
  attendees:   z.array(DraftAttendeeSchema).default([]),
});

export type DraftCalendarEvent = z.infer<typeof DraftCalendarEventSchema>;

// ─── DraftSlackMessage ──────────────────────────────────────────────────────

export const DraftSlackMessageSchema = z.object({
  kind: z.literal("slack_message"),
  // Whatever Slack accepts: "#general", "C0123ABC", or a resolved DM channel
  // ID like "D0123ABC". The runner resolved it from a name query at propose
  // time so commit can just postMessage(channel, text) directly.
  channel: z.string().min(1, "Channel is required"),
  // Human label for the confirm card ("#general", "Mike Smith"). Display-only.
  recipient_display: z.string().min(1),
  // "channel" (broadcast) vs "dm" (direct message to a person). Drives the
  // confirm-card copy so users know they're about to DM someone vs post
  // publicly.
  recipient_kind: z.enum(["channel", "dm"]),
  text: z.string().min(1, "Message text is required").max(4000),
});

export type DraftSlackMessage = z.infer<typeof DraftSlackMessageSchema>;

// ─── Draft union ────────────────────────────────────────────────────────────

export const DraftSchema = z.discriminatedUnion("kind", [
  DraftTaskSchema,
  DraftCalendarEventSchema,
  DraftSlackMessageSchema,
]);

export type Draft = z.infer<typeof DraftSchema>;
export type DraftKind = Draft["kind"];

// ─── One-line summary for the confirm card ──────────────────────────────────

/**
 * Returns a short human-readable summary of a draft, suitable for the title
 * of a confirm card. Pure function — no DB calls.
 */
export function summarizeDraft(draft: Draft): string {
  switch (draft.kind) {
    case "task": {
      const parts: string[] = [`Create task: "${draft.title}"`];
      if (draft.due_date) parts.push(`due ${draft.due_date}`);
      if (draft.assignee_display) parts.push(`assign ${draft.assignee_display}`);
      return parts.join(" · ");
    }
    case "calendar_event": {
      const parts: string[] = [`Schedule: "${draft.summary}"`];
      // Show just the date + start time on the summary; full details on the card.
      const startTime = draft.start_iso.replace("T", " ");
      parts.push(startTime);
      if (draft.attendees.length > 0) {
        const names = draft.attendees
          .map((a) => a.display ?? a.email)
          .slice(0, 3)
          .join(", ");
        const more = draft.attendees.length > 3 ? ` +${draft.attendees.length - 3}` : "";
        parts.push(`with ${names}${more}`);
      }
      return parts.join(" · ");
    }
    case "slack_message": {
      const verb = draft.recipient_kind === "dm" ? "DM" : "Post to";
      // Single-line preview of the message — first 60 chars.
      const preview = draft.text.length > 60
        ? draft.text.slice(0, 57) + "…"
        : draft.text;
      return `${verb} ${draft.recipient_display}: "${preview}"`;
    }
  }
}

// ─── Tool-runner envelope ───────────────────────────────────────────────────

/**
 * Shape returned by `propose_*` tool runners (as JSON-stringified value).
 * The assistant route detects this shape by tool name (`propose_*`) and the
 * `kind: "draft"` discriminator, then emits a `tool_draft` SSE event so the
 * client can render a confirm card.
 *
 * The `draft` field is also fed back to the model as the tool_result so the
 * model knows what was proposed and can produce a brief text reply
 * ("Draft ready — hit Confirm if that's right").
 */
export type ProposeToolEnvelope = {
  kind: "draft";
  draft_id: string;
  draft: Draft;
  summary: string;
};

/**
 * Shape returned by a `propose_*` tool runner when name-resolution is
 * ambiguous. The model is expected to surface the choices to the user as
 * text and re-call the tool with the user's pick.
 */
export type ProposeAmbiguousEnvelope = {
  kind: "ambiguous";
  reason: string;
  candidates: Array<{ id: string; display: string }>;
};

/**
 * Shape returned by a `propose_*` tool runner when something went wrong
 * before a draft could be built (e.g. no profile matched the assignee
 * query, date couldn't be parsed). The model surfaces this to the user as
 * text.
 */
export type ProposeErrorEnvelope = {
  kind: "error";
  error: string;
};

export type ProposeResult =
  | ProposeToolEnvelope
  | ProposeAmbiguousEnvelope
  | ProposeErrorEnvelope;
