"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { addComment, type AddCommentState } from "./actions";

type Profile = { id: string; full_name: string | null; email: string };

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string | null; email: string } | null;
};

const initial: AddCommentState = { error: null, success: false };

export function CommentSection({
  taskId,
  comments,
  profiles,
}: {
  taskId: string;
  currentUserId: string;
  comments: Comment[];
  /** Mentionable users. Pass the same set the page already has. */
  profiles: Profile[];
}) {
  const [state, formAction, isPending] = useActionState(addComment, initial);
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);

  // Reset draft + mentions after a successful post
  if (state.success && (draft.length > 0 || mentions.length > 0)) {
    setDraft("");
    setMentions([]);
  }

  return (
    <div className="p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h3>

      {comments.length > 0 && (
        <div className="space-y-4 mb-5">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600 flex-shrink-0">
                {(c.author?.full_name ?? c.author?.email ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-medium text-zinc-700">
                    {c.author?.full_name ?? c.author?.email ?? "Unknown"}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {format(parseISO(c.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">
                  {renderWithMentions(c.body)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="task_id" value={taskId} />
        <input type="hidden" name="mentions" value={JSON.stringify(mentions)} />
        <MentionTextarea
          name="body"
          value={draft}
          onChange={setDraft}
          mentions={mentions}
          onMentionsChange={setMentions}
          profiles={profiles}
          placeholder="Add a comment… Type @ to mention someone."
        />
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
        <div className="flex justify-between items-center">
          <p className="text-[10px] text-zinc-400">
            {mentions.length > 0 ? `${mentions.length} person mentioned` : "Type @ to mention"}
          </p>
          <button
            type="submit"
            disabled={isPending || draft.trim().length === 0}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
          >
            {isPending ? "Posting…" : "Post Comment"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Mention-aware textarea ──────────────────────────────────────────────────

function MentionTextarea({
  name,
  value,
  onChange,
  mentions,
  onMentionsChange,
  profiles,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  mentions: string[];
  onMentionsChange: (v: string[]) => void;
  profiles: Profile[];
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [suggestion, setSuggestion] = useState<{ start: number; query: string } | null>(null);
  const [highlightedIdx, setHighlightedIdx] = useState(0);

  // Filter profiles by what the user is typing after "@"
  const filtered = useMemo(() => {
    if (!suggestion) return [];
    const q = suggestion.query.toLowerCase();
    if (q.length === 0) return profiles.slice(0, 6);
    return profiles
      .filter((p) => {
        const name = (p.full_name ?? "").toLowerCase();
        const local = p.email.split("@")[0].toLowerCase();
        return name.includes(q) || local.includes(q);
      })
      .slice(0, 6);
  }, [profiles, suggestion]);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    onChange(v);
    const caret = e.target.selectionStart;
    // Find the last "@" before the caret, with no whitespace between
    const upToCaret = v.slice(0, caret);
    const match = upToCaret.match(/(^|\s)@([\w-]*)$/);
    if (match) {
      setSuggestion({ start: caret - match[2].length - 1, query: match[2] });
      setHighlightedIdx(0);
    } else {
      setSuggestion(null);
    }
  }

  function selectProfile(p: Profile) {
    if (!suggestion) return;
    const ta = taRef.current;
    if (!ta) return;
    const display = (p.full_name ?? p.email.split("@")[0]).replace(/\s+/g, "");
    const before = value.slice(0, suggestion.start);
    const afterCaretIdx = suggestion.start + suggestion.query.length + 1; // +1 for "@"
    const after = value.slice(afterCaretIdx);
    const next = `${before}@${display} ${after}`;
    onChange(next);
    if (!mentions.includes(p.id)) onMentionsChange([...mentions, p.id]);
    setSuggestion(null);
    // Move caret to just after the mention + space
    requestAnimationFrame(() => {
      const pos = before.length + display.length + 2; // "@" + space
      ta.setSelectionRange(pos, pos);
      ta.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestion || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectProfile(filtered[highlightedIdx]);
    } else if (e.key === "Escape") {
      setSuggestion(null);
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        name={name}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setSuggestion(null), 150)}
        rows={2}
        placeholder={placeholder}
        required
        className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-400 resize-none"
      />
      {suggestion && filtered.length > 0 && (
        <div className="absolute z-30 left-2 right-2 bottom-full mb-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-50 border-b border-zinc-100">
            Mention someone
          </p>
          {filtered.map((p, i) => {
            const display = p.full_name ?? p.email.split("@")[0];
            return (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectProfile(p); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  i === highlightedIdx ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
              >
                <span className="inline-flex w-6 h-6 rounded-full bg-zinc-200 items-center justify-center text-[10px] font-semibold text-zinc-700">
                  {display[0].toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-zinc-900 truncate">{display}</span>
                  <span className="block text-[10px] text-zinc-500 truncate">{p.email}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Display mentions in posted comments with a subtle highlight ─────────────

function renderWithMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\w[\w-]*)/g);
  return parts.map((part, i) => {
    if (/^@\w/.test(part)) {
      return (
        <span
          key={i}
          className="rounded bg-blue-50 text-blue-700 font-medium px-0.5"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
