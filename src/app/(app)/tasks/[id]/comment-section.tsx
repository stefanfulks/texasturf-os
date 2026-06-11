"use client";

import { Fragment, useActionState, useState } from "react";
import { format, parseISO } from "date-fns";
import { addComment, type AddCommentState } from "./actions";
import { RefInput } from "@/components/refs/ref-input";
import { RefText } from "@/components/refs/ref-text";

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
                  <RefText
                    text={c.body}
                    renderText={(t, key) => <Fragment key={key}>{renderWithMentions(t)}</Fragment>}
                  />
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="task_id" value={taskId} />
        <input type="hidden" name="mentions" value={JSON.stringify(mentions)} />
        <RefInput
          name="body"
          value={draft}
          onChange={setDraft}
          mentions={mentions}
          onMentionsChange={setMentions}
          profiles={profiles}
          multiline
          rows={2}
          required
          dropdownPosition="above"
          placeholder="Add a comment… @ to mention, # to link a task, job, invoice, or client."
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 placeholder:text-zinc-400 resize-none"
        />
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
        <div className="flex justify-between items-center">
          <p className="text-[10px] text-zinc-400">
            {mentions.length > 0 ? `${mentions.length} person mentioned` : "@ to mention · # to link"}
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
