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
          className="h-11 px-4 rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 hover:border-zinc-500 active:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Restoring…" : "Restore job"}
        </button>
        {state.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
      </form>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-11 px-4 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-700 hover:border-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
      >
        Archive job
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2 flex-wrap">
      <input type="hidden" name="job_id" value={jobId} />
      <span className="text-xs text-zinc-600">Archive this job?</span>
      <button
        type="submit"
        disabled={isPending}
        className="h-9 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 active:bg-red-800 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Archiving…" : "Yes, archive"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-9 px-3 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:border-zinc-400 active:bg-zinc-50 transition-colors"
      >
        Cancel
      </button>
      {state.error && <span className="ml-1 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
