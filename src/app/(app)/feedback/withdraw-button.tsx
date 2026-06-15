"use client";

import { useActionState, useState } from "react";
import { withdrawFeedback, type FeedbackMutationState } from "./actions";

const initial: FeedbackMutationState = { error: null, success: false };

/**
 * Lets a submitter withdraw (soft-delete) their own feedback while it's still
 * untriaged. Two-step confirm so it isn't a one-tap mistake.
 */
export function WithdrawButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(withdrawFeedback, initial);

  if (state.success) return <span className="text-xs text-ink-4">Withdrawn</span>;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-ink-3 transition-colors hover:text-danger"
      >
        Withdraw
      </button>
    );
  }

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-ink-3">Withdraw this?</span>
      <button type="submit" disabled={pending} className="text-xs font-semibold text-danger hover:underline disabled:opacity-50">
        {pending ? "…" : "Yes"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-xs text-ink-4 hover:text-ink-2">
        No
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
