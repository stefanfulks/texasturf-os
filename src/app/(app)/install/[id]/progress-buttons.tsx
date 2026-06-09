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
          className="w-full rounded-2xl bg-zinc-900 px-6 py-5 text-base font-semibold text-white hover:bg-zinc-700 active:bg-zinc-950 disabled:opacity-50 transition-colors"
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
                  ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")
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
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white resize-none"
            />
            <button
              type="button"
              onClick={() => { setShowNotes(false); setNotes(""); }}
              className="text-xs text-zinc-500 hover:text-zinc-900"
            >
              Discard note
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-xs text-zinc-500 hover:text-zinc-900"
          >
            + Add a note to the next event
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="text-[11px] text-zinc-400">
        Current: {JOB_PROGRESS_LABELS[currentState]}
      </p>
    </div>
  );
}
