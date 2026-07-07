"use client";

import { useActionState, useState } from "react";
import { Bug, Lightbulb, HelpCircle, MoreHorizontal } from "lucide-react";
import { submitFeedback, type SubmitFeedbackState } from "./actions";
import { FeedbackImageDropzone } from "@/components/feedback-image-dropzone";

const initial: SubmitFeedbackState = { error: null, success: false };

const CATEGORIES = [
  { value: "bug",             label: "Bug",             icon: Bug,             color: "bg-danger-tint text-danger border-danger/30" },
  { value: "feature_request", label: "Feature request", icon: Lightbulb,       color: "bg-warn-tint text-warn border-warn/30" },
  { value: "question",        label: "Question",        icon: HelpCircle,      color: "bg-info-tint text-info border-info/30" },
  { value: "other",           label: "Other",           icon: MoreHorizontal,  color: "bg-hover text-ink-2 border-line" },
] as const;

export function FeedbackForm({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(submitFeedback, initial);
  const [category, setCategory] = useState<typeof CATEGORIES[number]["value"]>("bug");
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);

  // Page URL the user was on before clicking Feedback (helps triage)
  const pageUrl = typeof window !== "undefined" ? document.referrer || window.location.href : "";

  if (state.success) {
    return (
      <div className="rounded-xl border border-brand/30 bg-brand-tint p-6 text-sm text-brand">
        <p className="font-semibold mb-1">Thanks — we got it.</p>
        <p>Your feedback was submitted. Admin will triage it from the Team page.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 inline-flex items-center text-xs font-medium text-brand hover:text-brand underline"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="card p-6 space-y-5">
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="page_url" value={pageUrl} />

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-2">What kind of feedback?</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map(({ value, label, icon: Icon, color }) => {
            const on = category === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors " +
                  (on
                    ? color + " ring-2 ring-offset-1 ring-offset-white"
                    : "border-line bg-white text-ink-2 hover:border-line-strong")
                }
                aria-pressed={on}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">
          Subject *
        </label>
        <input
          name="subject"
          required
          minLength={3}
          placeholder={
            category === "bug"             ? "Quick summary — e.g. 'Slack uploads created duplicate invoices'" :
            category === "feature_request" ? "What would you like to see? — e.g. 'Bulk-archive tasks'" :
            category === "question"        ? "What's your question? — e.g. 'How do I assign a roll to a job?'" :
                                             "What's on your mind?"
          }
          className="field-input"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">
          Details
        </label>
        <textarea
          name="body"
          rows={5}
          placeholder={
            category === "bug"
              ? "Steps to reproduce, what you expected vs what happened, anything that helps us track it down."
              : "More context — the more specific, the faster we can act on it."
          }
          className="w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-strong resize-y"
        />
      </div>

      <FeedbackImageDropzone userId={userId} onUploadingChange={setAttachmentsUploading} />

      {state.error && (
        <p className="text-xs text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || attachmentsUploading}
          className="px-4 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-strong disabled:opacity-50"
        >
          {attachmentsUploading ? "Uploading…" : isPending ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </form>
  );
}
