"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveJob, unarchiveJob, type ArchiveJobState } from "../actions";

const initial: ArchiveJobState = { error: null, success: false };

export function JobArchiveButton({
  jobId,
  archived,
}: {
  jobId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const action = archived ? unarchiveJob : archiveJob;
  const [state, formAction, isPending] = useActionState(action, initial);

  if (state.success) setTimeout(() => router.refresh(), 0);

  if (archived) {
    return (
      <form action={formAction}>
        <input type="hidden" name="job_id" value={jobId} />
        <button
          type="submit"
          disabled={isPending}
          className="h-11 px-4 rounded-xl border border-line-strong bg-white text-sm font-semibold text-ink-2 hover:border-line-strong active:bg-hover disabled:opacity-50 transition-colors"
        >
          {isPending ? "Restoring…" : "Restore job"}
        </button>
        {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
      </form>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-11 px-4 rounded-xl border border-danger/30 bg-white text-sm font-semibold text-danger hover:border-danger/30 hover:bg-danger-tint active:bg-danger-tint transition-colors"
      >
        Archive job
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2 flex-wrap">
      <input type="hidden" name="job_id" value={jobId} />
      <span className="text-xs text-ink-2">Archive this job?</span>
      <button
        type="submit"
        disabled={isPending}
        className="h-9 px-3 rounded-lg bg-danger text-white text-xs font-semibold hover:bg-danger active:bg-danger disabled:opacity-50 transition-colors"
      >
        {isPending ? "Archiving…" : "Yes, archive"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-9 px-3 rounded-lg border border-line bg-white text-xs font-semibold text-ink-2 hover:border-line-strong active:bg-hover transition-colors"
      >
        Cancel
      </button>
      {state.error && <span className="ml-1 text-xs text-danger">{state.error}</span>}
    </form>
  );
}
