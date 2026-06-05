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
  new:         "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved:    "bg-green-100 text-green-700",
  wont_fix:    "bg-zinc-100 text-zinc-500",
};
const CATEGORY_BADGE: Record<string, string> = {
  bug:             "bg-red-50 text-red-700 border-red-200",
  feature_request: "bg-amber-50 text-amber-700 border-amber-200",
  question:        "bg-blue-50 text-blue-700 border-blue-200",
  other:           "bg-zinc-50 text-zinc-700 border-zinc-200",
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
    <li className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="p-5 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900">{item.subject}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {submitter} · {format(parseISO(item.created_at), "MMM d, h:mm a")}
              {item.page_url && (
                <>
                  {" · from "}
                  <span className="font-mono text-[10px] bg-zinc-100 px-1 rounded">
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
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{item.body}</p>
        )}

        {item.admin_notes && !editing && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
            <p className="font-medium mb-0.5">Admin reply</p>
            {item.admin_notes}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-3">
        {!editing ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-2.5 py-1 text-xs font-medium border border-zinc-200 rounded-md text-zinc-700 hover:border-zinc-400 transition-colors bg-white"
            >
              Triage
            </button>
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="id" value={item.id} />
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 items-start">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Status</label>
                <select
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Admin note (visible to submitter)
                </label>
                <textarea
                  name="admin_notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional: what you're doing about it, or a follow-up question."
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-y"
                />
              </div>
            </div>
            {state.error && <p className="text-xs text-red-600">{state.error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setEditing(false); setStatus(item.status); setAdminNotes(item.admin_notes ?? ""); }}
                className="px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-3 py-1 text-xs font-semibold bg-zinc-900 text-white rounded-md hover:bg-zinc-700 disabled:opacity-50"
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
