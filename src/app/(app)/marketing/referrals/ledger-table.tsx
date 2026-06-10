"use client";

import { useActionState } from "react";
import { createReferral, updateReferralStage, updateReward, type ActionState } from "./actions";
import type { ReferralRow } from "./page";

const initial: ActionState = { error: null, success: false };
const field =
  "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";
const select =
  "text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400";

const STAGES = [
  ["lead", "Lead"],
  ["contacted", "Contacted"],
  ["quoted", "Quoted"],
  ["signed", "Signed"],
  ["completed_paid", "Completed + paid"],
  ["lost", "Lost"],
] as const;

const REWARD_TYPES = [
  ["undecided", "Reward: undecided"],
  ["visa_250", "$250 Visa card"],
  ["care_plan_1yr", "Care Plan (1 yr)"],
] as const;

const REWARD_BADGE: Record<ReferralRow["reward_status"], string> = {
  not_earned: "bg-zinc-100 text-zinc-500",
  due: "bg-red-50 text-red-700",
  sent: "bg-emerald-50 text-emerald-700",
};

function StageSelect({ row }: { row: ReferralRow }) {
  const [state, formAction] = useActionState(updateReferralStage, initial);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="referral_id" value={row.id} />
      <select
        name="stage"
        defaultValue={row.stage}
        className={select}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {STAGES.map(([val, label]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.info && <span className="text-xs text-emerald-700">{state.info}</span>}
    </form>
  );
}

function RewardControls({ row, isAdmin }: { row: ReferralRow; isAdmin: boolean }) {
  const [typeState, typeAction] = useActionState(updateReward, initial);
  const [sentState, sentAction, sentPending] = useActionState(updateReward, initial);
  const [overrideState, overrideAction, overridePending] = useActionState(updateReward, initial);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <form action={typeAction} className="inline-flex items-center gap-1">
        <input type="hidden" name="referral_id" value={row.id} />
        <select
          name="reward_type"
          defaultValue={row.reward_type}
          className={select}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {REWARD_TYPES.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        {typeState.error && <span className="text-xs text-red-600">{typeState.error}</span>}
      </form>

      <span className={`text-xs px-2 py-0.5 rounded font-medium ${REWARD_BADGE[row.reward_status]}`}>
        {row.reward_status === "not_earned" ? "Not earned" : row.reward_status === "due" ? "DUE" : "Sent"}
      </span>

      {row.reward_status === "due" && (
        <form action={sentAction} className="inline">
          <input type="hidden" name="referral_id" value={row.id} />
          <input type="hidden" name="mark_sent" value="true" />
          <button
            type="submit"
            disabled={sentPending}
            className="text-xs px-2 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {sentPending ? "…" : "Mark sent"}
          </button>
          {sentState.error && <span className="text-xs text-red-600 ml-1">{sentState.error}</span>}
        </form>
      )}

      {isAdmin && (
        <details className="inline-block">
          <summary className="text-xs text-zinc-400 cursor-pointer select-none">override</summary>
          <form action={overrideAction} className="mt-2 flex items-center gap-2 flex-wrap">
            <input type="hidden" name="referral_id" value={row.id} />
            <select name="override_status" className={select} defaultValue={row.reward_status}>
              <option value="not_earned">not_earned</option>
              <option value="due">due</option>
              <option value="sent">sent</option>
            </select>
            <input name="reward_note" required placeholder="Reason (required)" className={`${field} !w-56 !py-1 !text-xs`} />
            <button
              type="submit"
              disabled={overridePending}
              className="text-xs px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
            >
              Apply
            </button>
            {overrideState.error && <span className="text-xs text-red-600">{overrideState.error}</span>}
          </form>
        </details>
      )}
    </div>
  );
}

export function LedgerTable({ rows, isAdmin }: { rows: ReferralRow[]; isAdmin: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-zinc-400">
        No referrals yet. They&rsquo;ll land here as calls produce names — first one&rsquo;s coming.
      </div>
    );
  }
  return (
    <div className="divide-y divide-zinc-100">
      {rows.map((row) => (
        <div key={row.id} className="px-5 py-3.5 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-48">
              <p className="text-sm font-semibold text-zinc-900">
                {row.referred_name}
                <span className="font-normal text-zinc-400"> ← referred by {row.referrer_name}</span>
              </p>
              <p className="text-xs text-zinc-400">
                {row.referred_phone ?? "no phone"}
                {row.service_interest ? ` · wants: ${row.service_interest}` : ""}
                {row.notes ? ` · ${row.notes}` : ""}
              </p>
            </div>
            <StageSelect row={row} />
          </div>
          <RewardControls row={row} isAdmin={isAdmin} />
        </div>
      ))}
    </div>
  );
}

export function AddReferralForm({ campaignId }: { campaignId: string }) {
  const [state, formAction, isPending] = useActionState(createReferral, initial);
  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <input type="hidden" name="campaign_id" value={campaignId} />
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Referrer (existing client) *</label>
        <input name="referrer_name" required placeholder="Who sent them" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Referred name *</label>
        <input name="referred_name" required placeholder="New prospect" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Referred phone</label>
        <input name="referred_phone" placeholder="(512) 555-0100" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Interested in</label>
        <input name="service_interest" placeholder="turf, fencing, court…" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Source</label>
        <select name="source" defaultValue="word_of_mouth" className={field}>
          <option value="call">Call campaign</option>
          <option value="jobber_link">Jobber referral link</option>
          <option value="word_of_mouth">Word of mouth</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add referral"}
        </button>
      </div>
      {state.error && <p className="text-xs text-red-600 sm:col-span-3">{state.error}</p>}
      {state.info && <p className="text-xs text-emerald-700 sm:col-span-3">{state.info}</p>}
    </form>
  );
}
