"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Sparkles, Search, Loader2, Check, X, ListPlus, CalendarPlus } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  /** Optional inline log of tool calls the assistant made during this turn. */
  tools?: ToolEvent[];
  /** Optional inline drafts (write-tool proposals awaiting Confirm/Cancel). */
  drafts?: DraftCard[];
};

type ToolEvent = { name: string; input: unknown };

/** A pending or settled draft attached to an assistant turn. */
type DraftCard = {
  draft_id: string;
  /** Untyped here — re-validated server-side on commit against the Zod schema. */
  draft: { kind: string; [key: string]: unknown };
  summary: string;
  status: "pending" | "committing" | "committed" | "cancelled" | "error";
  result?: { summary: string; view_url: string | null };
  error?: string;
};

type StreamEvent =
  | { type: "text";        text: string }
  | { type: "tool";        name: string; input: unknown }
  | { type: "tool_result"; name: string; ok: boolean }
  | { type: "tool_draft";  draft_id: string; draft: { kind: string; [key: string]: unknown }; summary: string }
  | { type: "done" }
  | { type: "error";       message: string };

// ─── Suggested starter prompts ────────────────────────────────────────────────

const STARTERS = [
  "What tasks am I overdue on?",
  "Show me invoices waiting for approval.",
  "How much Saratoga 40 do we have available?",
  "Add a task to walk the Sage Creek site tomorrow.",
];

// ─── Main component ───────────────────────────────────────────────────────────

export function AssistantChat({
  greetingName,
  compact = false,
}: {
  greetingName: string;
  /**
   * When true, the chat sizes itself to fill its parent (intended for the
   * floating TurfyLauncher popover). When false (default), it uses the
   * full-page sizing originally designed for /assistant.
   */
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const next: ChatMessage[] = [
      ...messages,
      { role: "user", text: trimmed },
      { role: "assistant", text: "", tools: [] },
    ];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    // Build Anthropic-style message history from our chat state
    const apiMessages = next
      .slice(0, -1) // drop the empty placeholder we just added
      .filter((m) => m.text.length > 0 || m.role === "user")
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const resp = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => "");
        throw new Error(errText || `Server returned ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        // Parse line-by-line; SSE messages end with \n\n
        const chunks = buffered.split("\n\n");
        buffered = chunks.pop() ?? "";
        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(chunk.slice(6)) as StreamEvent;
          } catch {
            continue;
          }
          applyEvent(evt);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function applyEvent(evt: StreamEvent) {
    setMessages((cur) => {
      const copy = [...cur];
      const last = copy[copy.length - 1];
      if (!last || last.role !== "assistant") return cur;

      if (evt.type === "text") {
        copy[copy.length - 1] = { ...last, text: last.text + evt.text };
      } else if (evt.type === "tool") {
        copy[copy.length - 1] = {
          ...last,
          tools: [...(last.tools ?? []), { name: evt.name, input: evt.input }],
        };
      } else if (evt.type === "tool_draft") {
        copy[copy.length - 1] = {
          ...last,
          drafts: [
            ...(last.drafts ?? []),
            {
              draft_id: evt.draft_id,
              draft:    evt.draft,
              summary:  evt.summary,
              status:   "pending",
            },
          ],
        };
      } else if (evt.type === "error") {
        setError(evt.message);
      }
      return copy;
    });
  }

  // ─── Draft commit / cancel handlers ──────────────────────────────────────

  function updateDraft(draftId: string, patch: Partial<DraftCard>) {
    setMessages((cur) =>
      cur.map((m) =>
        m.drafts?.some((d) => d.draft_id === draftId)
          ? {
              ...m,
              drafts: m.drafts.map((d) =>
                d.draft_id === draftId ? { ...d, ...patch } : d,
              ),
            }
          : m,
      ),
    );
  }

  async function commitDraft(card: DraftCard) {
    if (card.status !== "pending") return;
    updateDraft(card.draft_id, { status: "committing" });
    try {
      const resp = await fetch("/api/assistant/commit-draft", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(card.draft),
      });
      const json = (await resp.json().catch(() => null)) as
        | { ok: true;  summary: string; view_url: string | null; created_id: string | null }
        | { ok: false; error: string }
        | null;
      if (!json) {
        updateDraft(card.draft_id, { status: "error", error: `Server returned ${resp.status}` });
        return;
      }
      if (json.ok) {
        updateDraft(card.draft_id, {
          status: "committed",
          result: { summary: json.summary, view_url: json.view_url },
        });
      } else {
        updateDraft(card.draft_id, { status: "error", error: json.error });
      }
    } catch (err) {
      updateDraft(card.draft_id, {
        status: "error",
        error:  err instanceof Error ? err.message : String(err),
      });
    }
  }

  function cancelDraft(card: DraftCard) {
    if (card.status !== "pending") return;
    updateDraft(card.draft_id, { status: "cancelled" });
  }

  return (
    <div
      className={
        compact
          ? "rounded-2xl border border-zinc-200 bg-white overflow-hidden flex flex-col h-full"
          : "rounded-2xl border border-zinc-200 bg-white overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[480px]"
      }
    >
      {/* Scroll area */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-5 py-6 space-y-5"
      >
        {messages.length === 0 ? (
          <EmptyState greetingName={greetingName} onPick={send} />
        ) : (
          messages.map((m, i) => (
            <Bubble
              key={i}
              message={m}
              busy={busy && i === messages.length - 1}
              onCommitDraft={commitDraft}
              onCancelDraft={cancelDraft}
            />
          ))
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-end gap-2 border-t border-zinc-100 bg-zinc-50/50 px-4 py-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask anything…"
          disabled={busy}
          className="flex-1 resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 max-h-40"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Thinking" : "Send"}
        </button>
      </form>
    </div>
  );
}

// ─── Bubble ──────────────────────────────────────────────────────────────────

function Bubble({
  message,
  busy,
  onCommitDraft,
  onCancelDraft,
}: {
  message: ChatMessage;
  busy: boolean;
  onCommitDraft: (card: DraftCard) => void;
  onCancelDraft: (card: DraftCard) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div className={`min-w-0 max-w-[80%] space-y-2 ${isUser ? "items-end" : ""}`}>
        {/* Tool call log (assistant only) */}
        {!isUser && message.tools && message.tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.tools.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
              >
                <Search className="h-2.5 w-2.5" />
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Bubble */}
        <div
          className={
            isUser
              ? "rounded-2xl rounded-tr-sm bg-zinc-900 text-white px-4 py-2.5 text-sm"
              : "rounded-2xl rounded-tl-sm bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-2.5 text-sm whitespace-pre-wrap"
          }
        >
          {message.text || (busy ? <ThinkingDots /> : null)}
        </div>

        {/* Draft cards (assistant only) — proposed write actions awaiting Confirm/Cancel */}
        {!isUser && message.drafts && message.drafts.length > 0 && (
          <div className="space-y-2">
            {message.drafts.map((card) => (
              <DraftCardView
                key={card.draft_id}
                card={card}
                onConfirm={() => onCommitDraft(card)}
                onCancel={() => onCancelDraft(card)}
              />
            ))}
          </div>
        )}
      </div>
      {isUser && <div className="flex-shrink-0 h-7 w-7" />}
    </div>
  );
}

// ─── DraftCardView ──────────────────────────────────────────────────────────

/**
 * Renders a single proposed write action with Confirm/Cancel controls.
 * v1 only knows about the "task" kind; future draft kinds plug in here via
 * the small kind-switch inside renderDetails.
 */
function DraftCardView({
  card,
  onConfirm,
  onCancel,
}: {
  card: DraftCard;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { status } = card;

  // Settled states — replace the card with a compact status line.
  if (status === "committed") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
        <Check className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1 truncate">{card.result?.summary ?? "Done."}</span>
        {card.result?.view_url && (
          <Link
            href={card.result.view_url}
            className="font-semibold underline decoration-emerald-300 hover:decoration-emerald-500"
          >
            View
          </Link>
        )}
      </div>
    );
  }
  if (status === "cancelled") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 flex items-center gap-2">
        <X className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Cancelled.</span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
        <div className="flex items-center gap-2 mb-1.5">
          <X className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-semibold">Couldn&apos;t create — {card.error ?? "unknown error"}.</span>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          className="text-xs font-semibold underline decoration-red-300 hover:decoration-red-500"
        >
          Retry
        </button>
      </div>
    );
  }

  // Pending or committing → render the full proposal card.
  const isCommitting = status === "committing";
  const Icon = card.draft.kind === "calendar_event" ? CalendarPlus : ListPlus;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-xs space-y-2.5">
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 flex-shrink-0 text-blue-600 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-900">{card.summary}</p>
          <DraftDetails card={card} />
        </div>
      </div>
      <div className="flex justify-end gap-1.5 pt-1 border-t border-zinc-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={isCommitting}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isCommitting}
          className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isCommitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {isCommitting ? "Creating" : "Confirm"}
        </button>
      </div>
    </div>
  );
}

function DraftDetails({ card }: { card: DraftCard }) {
  // The Zod schema is the source of truth — the values here are read for
  // display only and never trusted for committing.
  const d = card.draft;
  if (d.kind === "task") {
    const due       = typeof d.due_date === "string" ? d.due_date : null;
    const assignee  = typeof d.assignee_display === "string" ? d.assignee_display : null;
    const priority  = typeof d.priority === "string" ? d.priority : "normal";
    const description = typeof d.description === "string" ? d.description : null;
    return (
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-[11px] text-zinc-600">
        {due && (<><dt className="font-medium text-zinc-500">Due</dt><dd>{due}</dd></>)}
        {assignee && (<><dt className="font-medium text-zinc-500">Assign</dt><dd>{assignee}</dd></>)}
        {priority !== "normal" && (<><dt className="font-medium text-zinc-500">Priority</dt><dd className="capitalize">{priority}</dd></>)}
        {description && (<><dt className="font-medium text-zinc-500">Notes</dt><dd className="whitespace-pre-wrap">{description}</dd></>)}
      </dl>
    );
  }
  if (d.kind === "calendar_event") {
    const start    = typeof d.start_iso === "string" ? d.start_iso.replace("T", " ") : null;
    const end      = typeof d.end_iso   === "string" ? d.end_iso.replace("T", " ")   : null;
    const location = typeof d.location  === "string" ? d.location : null;
    const description = typeof d.description === "string" ? d.description : null;
    const attendees = Array.isArray(d.attendees)
      ? (d.attendees as Array<{ email?: string; display?: string | null }>).filter((a) => typeof a.email === "string")
      : [];
    return (
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-[11px] text-zinc-600">
        {start && (<><dt className="font-medium text-zinc-500">Start</dt><dd>{start} CT</dd></>)}
        {end   && (<><dt className="font-medium text-zinc-500">End</dt><dd>{end} CT</dd></>)}
        {location && (<><dt className="font-medium text-zinc-500">Where</dt><dd>{location}</dd></>)}
        {attendees.length > 0 && (
          <>
            <dt className="font-medium text-zinc-500">Invite</dt>
            <dd>{attendees.map((a) => a.display ?? a.email).join(", ")}</dd>
          </>
        )}
        {description && (<><dt className="font-medium text-zinc-500">Notes</dt><dd className="whitespace-pre-wrap">{description}</dd></>)}
      </dl>
    );
  }
  return null;
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse [animation-delay:0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse [animation-delay:0.3s]" />
    </span>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({
  greetingName,
  onPick,
}: {
  greetingName: string;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div className="h-12 w-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 mb-4">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
        Hi {greetingName} — what can I dig up?
      </h2>
      <p className="mt-1 text-sm text-zinc-500 max-w-md">
        I have read-only access to your tasks, invoices, inventory, and vendors.
        Try one of these to start:
      </p>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-left text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
