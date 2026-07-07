"use client";

import { useActionState } from "react";
import { Star } from "lucide-react";
import { buildReviewList, updateReviewStatus, type ActionState } from "./actions";
import type { ReviewRow } from "./page";

const initial: ActionState = { error: null, success: false };

const STATUS_BADGE: Record<ReviewRow["status"], string> = {
  pending: "bg-warn-tint text-warn",
  requested: "bg-info-tint text-info",
  received: "bg-brand-tint text-brand",
  declined: "bg-sunken text-ink-3",
};

export function BuildReviewListButton() {
  const [state, formAction, isPending] = useActionState(buildReviewList, initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="days" value="90" />
      <button
        type="submit"
        disabled={isPending}
        className="btn btn-primary disabled:opacity-50"
      >
        {isPending ? "Building…" : "Build list from completed jobs"}
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
      {state.info && <span className="text-xs text-brand">{state.info}</span>}
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
        className="text-xs border border-line rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-line-strong"
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
      <div className="empty-state">
        <span className="medallion"><Star className="h-5 w-5" /></span>
        <p className="empty-state-title">No jobs in the list yet</p>
        <p className="empty-state-body">Hit “Build list from completed jobs” to pull recent completed installs.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.id} className="px-5 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <p className="text-sm font-semibold text-ink">{r.client_name}</p>
            <p className="text-xs text-ink-4">
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
              <StatusButton id={r.id} status="requested" label="Mark asked" className="border-info/30 text-info hover:bg-info-tint" />
            )}
            {r.status !== "received" && (
              <StatusButton id={r.id} status="received" label="Got it ✓" className="border-brand/30 text-brand hover:bg-brand-tint" />
            )}
            {r.status === "received" && <PlatformSelect id={r.id} platform={r.platform} />}
            {r.status !== "declined" && r.status !== "received" && (
              <StatusButton id={r.id} status="declined" label="No" className="border-line text-ink-3 hover:bg-hover" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
