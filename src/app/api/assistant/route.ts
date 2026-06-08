/**
 * TexasTurf OS assistant — streaming chat endpoint with tool calls.
 *
 * POST { messages: Anthropic.MessageParam[] }
 *
 * Streams Server-Sent Events:
 *   data: { "type": "text", "text": "..." }
 *   data: { "type": "tool", "name": "search_tasks", "input": {...} }
 *   data: { "type": "tool_result", "name": "search_tasks", "ok": true }
 *   data: { "type": "done" }
 *   data: { "type": "error", "message": "..." }
 *
 * Auth: signed-in only. Tools run with the caller's RLS context so the
 * assistant only sees data the caller is already permitted to see.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { TOOL_DEFS, runTool } from "@/lib/assistant/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are Turfy — TexasTurf's in-app assistant. TexasTurf
is a turf installation business; you help office, warehouse, sales, field,
marketing, and finance get through the day faster.

Voice:
- Punchy, low-ego, with a slight Texas swagger. Quick + confident. A "y'all"
  or "alright" once in a while is fine — not every line.
- Lead with the answer, the number, or the result. Skip the preamble.
- Plain English. Cut the corporate filler ("As your AI assistant…", "I'd be
  happy to…", "It's great that…"). No emoji.
- When you cite a record, give just enough to act on it: name + status + the
  one number or date that matters. Numbers get commas; money gets dollar
  signs.
- Never claim something is done that isn't. If a tool returned nothing, say
  nothing came back — don't dress it up.

Tools:
- You have read-only tools that hit the live company database under the
  caller's RLS context. The user only ever sees data they're already allowed
  to see.
- ALWAYS use a tool when the question is about a specific record, count,
  or list — never guess from memory.
- If the user asks for something you don't have a tool for yet (e.g. "update
  this roll's status", "create a task", "Slack Mike", "put it on my
  calendar"), tell them which page handles it today, and that write tools
  are on the way. When write tools land, you'll always show a confirm
  preview before running them — never silently mutate.

Domain quick-ref:
- Inventory tracks rolls. Parent rolls get cut into children. Status flow:
  available → planned → allocated → staged → dispatched → consumed, with
  side states damaged and returned. Child tags start with "C-".
- Invoices flow: submitted → awaiting_review → awaiting_approval → approved
  → paid. ocr_review_needed and request_change are exception states.
- Departments: Sales / Warehouse / Office / Field / Marketing / Financial.
  Roles: admin / office / field.

Example replies that hit the voice:
- "3 invoices waiting on you — Bell Concrete $4,820, Holt Cat $612, Sunbelt
  $1,140."
- "Saratoga 40: 6 rolls available, 412 ft total. Largest is C-2X0G2GHX at
  96 ft."
- "Nothing overdue. Three due today — site walk, OCR review, Mike's
  check-in."
- "Don't have a tool for that one yet. Bump the roll's status on /inventory
  and it'll flow through."`;

export async function POST(request: Request): Promise<Response> {
  // Auth: must be a signed-in user. RLS still applies on every tool query.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await request.json().catch(() => ({}))) as {
    messages?: Anthropic.MessageParam[];
  };
  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        // Multi-turn loop: model may call tools, we run them, feed results back.
        // Cap at 8 iterations to avoid runaway loops.
        const convo: Anthropic.MessageParam[] = [...messages];
        for (let iter = 0; iter < 8; iter++) {
          const turn = await client.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            tools: TOOL_DEFS,
            messages: convo,
          });

          // Stream out any text the model produced in this turn
          for (const block of turn.content) {
            if (block.type === "text") {
              send({ type: "text", text: block.text });
            }
          }

          // If no tool_use blocks, we're done
          const toolUses = turn.content.filter(
            (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
          );
          if (toolUses.length === 0 || turn.stop_reason !== "tool_use") {
            break;
          }

          // Append assistant turn + execute tools + append tool_result blocks
          convo.push({ role: "assistant", content: turn.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            send({ type: "tool", name: tu.name, input: tu.input });
            const result = await runTool(
              tu.name,
              (tu.input ?? {}) as Record<string, unknown>,
              supabase,
              user.id,
            );
            send({ type: "tool_result", name: tu.name, ok: true });
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: result,
            });
          }

          convo.push({ role: "user", content: toolResults });
        }

        send({ type: "done" });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
    },
  });
}
