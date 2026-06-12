"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { buildRoster, logCallOutcome, createReferral, type ActionState } from "./actions";
import type { OutreachRow } from "./page";

const initial: ActionState = { error: null, success: false };
const field =
  "w-full text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white";

const STATUS_BADGE: Record<OutreachRow["call_status"], string> = {
  queued: "bg-sunken text-ink-2",
  no_answer: "bg-warn-tint text-warn",
  declined: "bg-hover text-ink-3",
  referred: "bg-brand-tint text-brand",
  do_not_call: "bg-danger-tint text-danger",
  invalid_number: "bg-danger-tint text-danger",
};

const STATUS_LABEL: Record<OutreachRow["call_status"], string> = {
  queued: "Queued",
  no_answer: "No answer",
  declined: "Declined",
  referred: "Referred",
  do_not_call: "DNC",
  invalid_number: "Bad #",
};

export function BuildRosterButton({ campaignId }: { campaignId: string }) {
  const [state, formAction, isPending] = useActionState(buildRoster, initial);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-ink text-white rounded-lg hover:bg-ink disabled:opacity-50"
        >
          {isPending ? "Building…" : "Build roster from Jobber"}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-ink-3">
          <input type="checkbox" name="include_all" value="true" className="rounded border-line-strong" />
          all active clients (not just completed jobs)
        </label>
      </div>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
      {state.info && <span className="text-xs text-brand">{state.info}</span>}
    </form>
  );
}

function OutcomeButton({
  outreachId,
  status,
  label,
  className,
}: {
  outreachId: string;
  status: OutreachRow["call_status"];
  label: string;
  className: string;
}) {
  const [state, formAction, isPending] = useActionState(logCallOutcome, initial);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="outreach_id" value={outreachId} />
      <input type="hidden" name="call_status" value={status} />
      <button
        type="submit"
        disabled={isPending}
        title={state.error ?? undefined}
        className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${className}`}
      >
        {isPending ? "…" : label}
      </button>
    </form>
  );
}

function ReferredForm({
  row,
  campaignId,
  onDone,
}: {
  row: OutreachRow;
  campaignId: string;
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState(createReferral, initial);
  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);
  return (
    <form action={formAction} className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="outreach_id" value={row.id} />
      <input type="hidden" name="referrer_name" value={row.client_name} />
      <input type="hidden" name="source" value="call" />
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Referred name *</label>
        <input name="referred_name" required placeholder="Friend's name" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Phone</label>
        <input name="referred_phone" placeholder="(512) 555-0100" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Interested in</label>
        <input name="service_interest" placeholder="turf, pickleball court…" className={field} />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save referral"}
        </button>
        <button type="button" onClick={onDone} className="px-3 py-2 text-sm border border-line rounded-lg">
          Cancel
        </button>
      </div>
      {state.error && <p className="text-xs text-danger sm:col-span-4">{state.error}</p>}
    </form>
  );
}

function RosterRow({ row, campaignId }: { row: OutreachRow; campaignId: string }) {
  const [expanded, setExpanded] = useState(false);
  const callable = row.call_status === "queued" || row.call_status === "no_answer";
  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-48">
          <p className="text-sm font-semibold text-ink">{row.client_name}</p>
          <p className="text-xs text-ink-4">
            {row.client_phone ? (
              <a href={`tel:${row.client_phone}`} className="hover:underline">{row.client_phone}</a>
            ) : "no phone"}
            {row.last_job_note ? ` · ${row.last_job_note}` : ""}
          </p>
        </div>
        {row.segment === "b2b_partner" && (
          <span className="text-xs px-2 py-0.5 rounded bg-info-tint text-info font-medium">B2B</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[row.call_status]}`}>
          {STATUS_LABEL[row.call_status]}
          {row.attempts > 0 ? ` ·${row.attempts}` : ""}
        </span>
        {callable && (
          <div className="flex items-center gap-1.5">
            <OutcomeButton outreachId={row.id} status="no_answer" label="No answer" className="border-warn/30 text-warn hover:bg-warn-tint" />
            <OutcomeButton outreachId={row.id} status="declined" label="Declined" className="border-line text-ink-2 hover:bg-hover" />
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs px-2 py-1 rounded border border-brand/30 text-brand font-medium hover:bg-brand-tint"
            >
              Referred ✓
            </button>
            <OutcomeButton outreachId={row.id} status="do_not_call" label="DNC" className="border-danger/30 text-danger hover:bg-danger-tint" />
            <OutcomeButton outreachId={row.id} status="invalid_number" label="Bad #" className="border-danger/30 text-danger hover:bg-danger-tint" />
          </div>
        )}
      </div>
      {expanded && <ReferredForm row={row} campaignId={campaignId} onDone={() => setExpanded(false)} />}
    </div>
  );
}

export function RosterTable({ rows, campaignId }: { rows: OutreachRow[]; campaignId: string }) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-ink-4">
        Roster is empty — hit “Build roster from Jobber” to pull in every past client with a completed job and a phone number.
      </div>
    );
  }
  return (
    <div className="divide-y divide-line">
      {rows.map((row) => (
        <RosterRow key={row.id} row={row} campaignId={campaignId} />
      ))}
    </div>
  );
}
