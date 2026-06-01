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
        className="px-2.5 py-1 text-xs font-medium border border-red-200 rounded-md text-red-700 hover:border-red-500 hover:bg-red-50 transition-colors"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <span className="text-xs text-zinc-600">Delete {userLabel}?</span>
      <button
        type="submit"
        disabled={isPending}
        className="px-2.5 py-1 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="px-2 py-1 text-xs text-zinc-600 hover:text-zinc-900"
      >
        Cancel
      </button>
      {state.error && <span className="ml-1 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
