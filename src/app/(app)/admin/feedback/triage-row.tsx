"use client";

import { useActionState, useState } from "react";
import { format, parseISO } from "date-fns";
import { triageFeedback, type TriageFeedbackState } from "../../feedback/actions";

const initial: TriageFeedbackState = { error: null, success: false };

const STATUSES = ["new","in_progress","resolved","wont_fix"] as const;
const STATUS_LABEL: Record<string, string> = {
  new:         "New",
  in_progress: "In progress",
  resolved:    "Resolved",
  wont_fix:    "Won't fix",
};
const STATUS_BADGE: Record<string, string> = {
  new:         "bg-info-tint text-info",
  in_progress: "bg-warn-tint text-warn",
  resolved:    "bg-brand-tint text-brand",
  wont_fix:    "bg-sunken text-ink-3",
};
const CATEGORY_BADGE: Record<string, string> = {
  bug:             "bg-danger-tint text-danger border-danger/30",
  feature_request: "bg-warn-tint text-warn border-warn/30",
  question:        "bg-info-tint text-info border-info/30",
  other:           "bg-hover text-ink-2 border-line",
};
const CATEGORY_LABEL: Record<string, string> = {
  bug:             "Bug",
  feature_request: "Feature",
  question:        "Question",
  other:           "Other",
};

export function TriageRow({
  item,
}: {
  item: {
    id: string;
    category: string;
    subject: string;
    body: string | null;
    status: string;
    admin_notes: string | null;
    page_url: string | null;
    resolved_at: string | null;
    created_at: string;
    user: { id: string; full_name: string | null; email: string } | null;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(item.status);
  const [adminNotes, setAdminNotes] = useState(item.admin_notes ?? "");
  const [state, formAction, isPending] = useActionState(triageFeedback, initial);

  if (state.success && editing) setEditing(false);

  const submitter = item.user?.full_name ?? item.user?.email ?? "Unknown";

  return (
    <li className="rounded-xl border border-line bg-white overflow-hidden">
      <div className="p-5 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">{item.subject}</h3>
            <p className="text-xs text-ink-3 mt-0.5">
              {submitter} · {format(parseISO(item.created_at), "MMM d, h:mm a")}
              {item.page_url && (
                <>
                  {" · from "}
                  <span className="font-mono text-[10px] bg-sunken px-1 rounded">
                    {item.page_url.replace(/^https?:\/\/[^/]+/, "")}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${CATEGORY_BADGE[item.category] ?? ""}`}>
              {CATEGORY_LABEL[item.category] ?? item.category}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[item.status] ?? ""}`}>
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
          </div>
        </div>

        {item.body && (
          <p className="text-sm text-ink-2 whitespace-pre-wrap">{item.body}</p>
        )}

        {item.admin_notes && !editing && (
          <div className="rounded-md bg-brand-tint border border-brand/30 px-3 py-2 text-xs text-brand">
            <p className="font-medium mb-0.5">Admin reply</p>
            {item.admin_notes}
          </div>
        )}
      </div>

      <div className="border-t border-line bg-hover/50 px-5 py-3">
        {!editing ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-2.5 py-1 text-xs font-medium border border-line rounded-md text-ink-2 hover:border-line-strong transition-colors bg-white"
            >
              Triage
            </button>
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="id" value={item.id} />
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 items-start">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-4 mb-1">Status</label>
                <select
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full text-sm border border-line rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-line-strong"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-4 mb-1">
                  Admin note (visible to submitter)
                </label>
                <textarea
                  name="admin_notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional: what you're doing about it, or a follow-up question."
                  className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-strong resize-y"
                />
              </div>
            </div>
            {state.error && <p className="text-xs text-danger">{state.error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setEditing(false); setStatus(item.status); setAdminNotes(item.admin_notes ?? ""); }}
                className="px-2.5 py-1 text-xs text-ink-2 hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-3 py-1 text-xs font-semibold bg-ink text-white rounded-md hover:bg-ink disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save triage"}
              </button>
            </div>
          </form>
        )}
      </div>
    </li>
  );
}
