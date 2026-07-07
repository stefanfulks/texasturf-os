"use client";

import { useState, useTransition } from "react";
import { recordJobProgress } from "@/lib/jobs/actions";
import {
  JOB_PROGRESS_LABELS,
  type JobProgressState,
} from "@/lib/jobs/progress";

/**
 * Big, mobile-friendly buttons for the install state machine. The first
 * forward state is the PRIMARY action (large, dark button). Secondary
 * states (e.g. on_hold) are smaller pills below.
 *
 * Optimistic UI is intentional: tapping marks the button "Saving…" but the
 * server action revalidates the page so the timeline + current state pop
 * in fresh on the next render.
 */
export function ProgressButtons({
  jobberVisitId,
  pullListId,
  currentState,
  nextStates,
}: {
  jobberVisitId: string;
  pullListId: string | null;
  currentState: JobProgressState;
  nextStates: JobProgressState[];
}) {
  const [busy, setBusy] = useState<JobProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const primary = nextStates.find((s) => s !== "on_hold") ?? null;
  const others  = nextStates.filter((s) => s !== primary);

  async function trigger(state: JobProgressState) {
    setBusy(state); setError(null);
    const fd = new FormData();
    fd.set("jobber_visit_id", jobberVisitId);
    fd.set("state", state);
    if (pullListId) fd.set("pull_list_id", pullListId);
    if (notes.trim().length > 0) fd.set("notes", notes.trim());
    startTransition(async () => {
      try {
        await recordJobProgress(fd);
        setNotes("");
        setShowNotes(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      {primary && (
        <button
          type="button"
          onClick={() => trigger(primary)}
          disabled={busy !== null || isPending}
          className="w-full rounded-2xl bg-brand px-6 py-5 text-base font-semibold text-white hover:bg-brand-strong active:bg-brand-strong disabled:opacity-50 transition-colors"
        >
          {busy === primary ? "Saving…" : `Mark: ${JOB_PROGRESS_LABELS[primary]}`}
        </button>
      )}

      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => trigger(s)}
              disabled={busy !== null || isPending}
              className={
                "rounded-full border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 " +
                (s === "on_hold"
                  ? "border-warn/30 bg-warn-tint text-warn hover:bg-warn-tint"
                  : "border-line bg-white text-ink-2 hover:bg-hover")
              }
            >
              {busy === s ? "Saving…" : JOB_PROGRESS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      <div>
        {showNotes ? (
          <div className="space-y-2">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note (attached to the next event you tap)"
              className="field-input resize-none"
            />
            <button
              type="button"
              onClick={() => { setShowNotes(false); setNotes(""); }}
              className="text-xs text-ink-3 hover:text-ink"
            >
              Discard note
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-xs text-ink-3 hover:text-ink"
          >
            + Add a note to the next event
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <p className="text-[11px] text-ink-4">
        Current: {JOB_PROGRESS_LABELS[currentState]}
      </p>
    </div>
  );
}
