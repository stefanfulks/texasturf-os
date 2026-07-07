"use client";

import { useActionState } from "react";
import { format, parseISO } from "date-fns";
import { addInvoiceComment, type AddCommentState } from "../actions";
import type { InvoiceComment } from "@/lib/db-helpers.types";

const initial: AddCommentState = { error: null, success: false };

type CommentWithUser = InvoiceComment & { user: { full_name: string | null; email: string } };

export function InvoiceCommentSection({
  invoiceId,
  comments,
  // TODO: allow editing/deleting the viewer's own comments
  currentUserId,
  isOfficeOrAdmin,
}: {
  invoiceId: string;
  comments: CommentWithUser[];
  currentUserId: string;
  isOfficeOrAdmin: boolean;
}) {
  const [state, formAction, isPending] = useActionState(addInvoiceComment, initial);

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-line">
        <h2 className="text-sm font-semibold">Comments</h2>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="px-5 py-6 text-sm text-ink-4">No comments yet.</div>
      ) : (
        <div className="divide-y divide-line">
          {comments.map((c) => (
            <div key={c.id} className="px-5 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-ink-2">
                    {c.user.full_name ?? c.user.email.split("@")[0]}
                  </span>
                  {c.user_id === currentUserId && (
                    <span className="text-xs bg-sunken text-ink-3 px-1.5 py-0.5 rounded font-medium">You</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {c.visibility === "internal" && (
                    <span className="text-xs bg-sunken text-ink-3 px-1.5 py-0.5 rounded font-medium">Internal</span>
                  )}
                  <span className="text-xs text-ink-4">{format(parseISO(c.created_at), "MMM d, h:mm a")}</span>
                </div>
              </div>
              <p className="text-sm text-ink-2 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add comment */}
      <form action={formAction} className="border-t border-line p-5 space-y-3">
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <textarea
          name="body"
          rows={3}
          placeholder="Add a comment…"
          className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-strong resize-none"
          required
        />
        {isOfficeOrAdmin && (
          <div className="flex items-center gap-2">
            <select name="visibility" defaultValue="internal" className="text-xs border border-line rounded px-2 py-1 focus:outline-none">
              <option value="internal">Internal only</option>
              <option value="external">Visible to submitter</option>
            </select>
          </div>
        )}
        {state.error && <p className="text-xs text-danger">{state.error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary disabled:opacity-50"
          >
            {isPending ? "Posting…" : "Post Comment"}
          </button>
        </div>
      </form>
    </div>
  );
}
