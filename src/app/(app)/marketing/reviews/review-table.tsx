"use client";

import { useActionState } from "react";
import { buildReviewList, updateReviewStatus, type ActionState } from "./actions";
import type { ReviewRow } from "./page";

const initial: ActionState = { error: null, success: false };

const STATUS_BADGE: Record<ReviewRow["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  requested: "bg-blue-50 text-blue-700",
  received: "bg-emerald-50 text-emerald-700",
  declined: "bg-zinc-100 text-zinc-500",
};

export function BuildReviewListButton() {
  const [state, formAction, isPending] = useActionState(buildReviewList, initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="days" value="90" />
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
      >
        {isPending ? "Building…" : "Build list from completed jobs"}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.info && <span className="text-xs text-emerald-700">{state.info}</span>}
    </form>
  );
}

function StatusButton({ id, status, label, className }: { id: string; status: ReviewRow["status"]; label: string; className: string }) {
  const [state, formAction, isPending] = useActionState(updateReviewStatus, initial);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" disabled={isPending} title={state.error ?? undefined} className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${className}`}>
        {isPending ? "…" : label}
      </button>
    </form>
  );
}

function PlatformSelect({ id, platform }: { id: string; platform: ReviewRow["platform"] }) {
  const [, formAction] = useActionState(updateReviewStatus, initial);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value="received" />
      <select
        name="platform"
        defaultValue={platform ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="text-xs border border-zinc-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
      >
        <option value="" disabled>where?</option>
        <option value="google">Google</option>
        <option value="facebook">Facebook</option>
        <option value="jobber">Jobber</option>
        <option value="other">Other</option>
      </select>
    </form>
  );
}

export function ReviewTable({ rows }: { rows: ReviewRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-zinc-400">
        No jobs in the list yet — hit “Build list from completed jobs” to pull recent completed installs.
      </div>
    );
  }
  return (
    <div className="divide-y divide-zinc-100">
      {rows.map((r) => (
        <div key={r.id} className="px-5 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <p className="text-sm font-semibold text-zinc-900">{r.client_name}</p>
            <p className="text-xs text-zinc-400">
              {r.job_title ?? "Job"}
              {r.completed_on ? ` · done ${r.completed_on}` : ""}
              {r.client_phone ? ` · ${r.client_phone}` : ""}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[r.status]}`}>
            {r.status}{r.platform ? ` · ${r.platform}` : ""}
          </span>
          <div className="flex items-center gap-1.5">
            {(r.status === "pending" || r.status === "declined") && (
              <StatusButton id={r.id} status="requested" label="Mark asked" className="border-blue-200 text-blue-700 hover:bg-blue-50" />
            )}
            {r.status !== "received" && (
              <StatusButton id={r.id} status="received" label="Got it ✓" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" />
            )}
            {r.status === "received" && <PlatformSelect id={r.id} platform={r.platform} />}
            {r.status !== "declined" && r.status !== "received" && (
              <StatusButton id={r.id} status="declined" label="No" className="border-zinc-200 text-zinc-500 hover:bg-zinc-50" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
