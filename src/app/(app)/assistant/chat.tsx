"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Search, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  /** Optional inline log of tool calls the assistant made during this turn. */
  tools?: ToolEvent[];
};

type ToolEvent = { name: string; input: unknown };

type StreamEvent =
  | { type: "text";        text: string }
  | { type: "tool";        name: string; input: unknown }
  | { type: "tool_result"; name: string; ok: boolean }
  | { type: "done" }
  | { type: "error";       message: string };

// ─── Suggested starter prompts ────────────────────────────────────────────────

const STARTERS = [
  "What tasks am I overdue on?",
  "Show me invoices waiting for approval.",
  "How much Saratoga 40 do we have available?",
  "What's allocated to job 263?",
];

// ─── Main component ───────────────────────────────────────────────────────────

export function AssistantChat({ greetingName }: { greetingName: string }) {
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
      } else if (evt.type === "error") {
        setError(evt.message);
      }
      return copy;
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[480px]">
      {/* Scroll area */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-5 py-6 space-y-5"
      >
        {messages.length === 0 ? (
          <EmptyState greetingName={greetingName} onPick={send} />
        ) : (
          messages.map((m, i) => <Bubble key={i} message={m} busy={busy && i === messages.length - 1} />)
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

function Bubble({ message, busy }: { message: ChatMessage; busy: boolean }) {
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
      </div>
      {isUser && <div className="flex-shrink-0 h-7 w-7" />}
    </div>
  );
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
