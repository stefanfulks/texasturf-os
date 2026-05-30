"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveTeamMember, unarchiveTeamMember, type ArchiveMemberState } from "./actions";

const initial: ArchiveMemberState = { error: null, success: false };

export function TeamMemberArchiveButton({
  memberId,
  archived,
}: {
  memberId: string;
  /** True when team_members.active === false. */
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const action = archived ? unarchiveTeamMember : archiveTeamMember;
  const [state, formAction, isPending] = useActionState(action, initial);

  if (state.success) setTimeout(() => router.refresh(), 0);

  if (archived) {
    return (
      <form action={formAction}>
        <input type="hidden" name="member_id" value={memberId} />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 hover:border-zinc-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Restoring…" : "Restore member"}
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
        className="px-4 py-2 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-700 hover:border-red-500 hover:bg-red-50 transition-colors"
      >
        Archive member
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="member_id" value={memberId} />
      <span className="text-xs text-zinc-600">Archive this team member?</span>
      <button
        type="submit"
        disabled={isPending}
        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Archiving…" : "Yes, archive"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:border-zinc-400 transition-colors"
      >
        Cancel
      </button>
      {state.error && <span className="ml-1 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
