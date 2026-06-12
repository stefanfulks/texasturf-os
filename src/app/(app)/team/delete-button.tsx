"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { removeUser, type RemoveUserState } from "./actions";

const initial: RemoveUserState = { error: null, success: false };

export function DeleteUserButton({
  userId,
  userLabel,
}: {
  userId: string;
  userLabel: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(removeUser, initial);

  if (state.success) setTimeout(() => router.refresh(), 0);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="px-2.5 py-1 text-xs font-medium border border-danger/30 rounded-md text-danger hover:border-danger/30 hover:bg-danger-tint transition-colors"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <span className="text-xs text-ink-2">Delete {userLabel}?</span>
      <button
        type="submit"
        disabled={isPending}
        className="px-2.5 py-1 text-xs font-semibold bg-danger text-white rounded-md hover:bg-danger disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="px-2 py-1 text-xs text-ink-2 hover:text-ink"
      >
        Cancel
      </button>
      {state.error && <span className="ml-1 text-xs text-danger">{state.error}</span>}
    </form>
  );
}
