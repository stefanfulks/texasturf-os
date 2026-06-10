"use client";

import { useActionState } from "react";
import { updateCampaignStatus, toggleChannel, type ActionState } from "../actions";

const initial: ActionState = { error: null, success: false };

const STATUSES = ["draft", "active", "paused", "completed"] as const;

export function StatusControl({ id, status }: { id: string; status: string }) {
  const [state, formAction] = useActionState(updateCampaignStatus, initial);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
      >
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

function ChannelRow({ id, channel, done }: { id: string; channel: string; done: boolean }) {
  const [state, formAction, isPending] = useActionState(toggleChannel, initial);
  return (
    <form action={formAction} className="flex items-center gap-2 py-1.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="channel" value={channel} />
      <button
        type="submit"
        disabled={isPending}
        className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${done ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-300 text-transparent hover:border-zinc-400"}`}
        aria-label={done ? "Mark not done" : "Mark done"}
      >
        ✓
      </button>
      <span className={`text-sm ${done ? "text-zinc-400 line-through" : "text-zinc-700"}`}>{channel}</span>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function ChannelChecklist({ id, items }: { id: string; items: { channel: string; done_at: string | null }[] }) {
  return (
    <div className="divide-y divide-zinc-50">
      {items.map((it) => (
        <ChannelRow key={it.channel} id={id} channel={it.channel} done={!!it.done_at} />
      ))}
    </div>
  );
}
