"use client";

import { useActionState } from "react";
import { Gift } from "lucide-react";
import { createReferral, updateReferralStage, updateReward, type ActionState } from "./actions";
import type { ReferralRow } from "./page";

const initial: ActionState = { error: null, success: false };
const field =
  "field-input";
const select =
  "text-xs border border-line rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-line-strong";

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
  not_earned: "bg-sunken text-ink-3",
  due: "bg-danger-tint text-danger",
  sent: "bg-brand-tint text-brand",
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
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
      {state.info && <span className="text-xs text-brand">{state.info}</span>}
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
        {typeState.error && <span className="text-xs text-danger">{typeState.error}</span>}
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
            className="text-xs px-2 py-1 rounded bg-brand text-white font-medium hover:bg-brand disabled:opacity-50"
          >
            {sentPending ? "…" : "Mark sent"}
          </button>
          {sentState.error && <span className="text-xs text-danger ml-1">{sentState.error}</span>}
        </form>
      )}

      {isAdmin && (
        <details className="inline-block">
          <summary className="text-xs text-ink-4 cursor-pointer select-none">override</summary>
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
              className="text-xs px-2 py-1 rounded border border-line-strong hover:bg-hover disabled:opacity-50"
            >
              Apply
            </button>
            {overrideState.error && <span className="text-xs text-danger">{overrideState.error}</span>}
          </form>
        </details>
      )}
    </div>
  );
}

export function LedgerTable({ rows, isAdmin }: { rows: ReferralRow[]; isAdmin: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <span className="medallion"><Gift className="h-5 w-5" /></span>
        <p className="empty-state-title">No referrals yet</p>
        <p className="empty-state-body">They&rsquo;ll land here as calls produce names — first one&rsquo;s coming.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-line">
      {rows.map((row) => (
        <div key={row.id} className="px-5 py-3.5 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-48">
              <p className="text-sm font-semibold text-ink">
                {row.referred_name}
                <span className="font-normal text-ink-4"> ← referred by {row.referrer_name}</span>
              </p>
              <p className="text-xs text-ink-4">
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
        <label className="block text-xs font-medium text-ink-3 mb-1">Referrer (existing client) <span className="text-danger">*</span></label>
        <input name="referrer_name" required placeholder="Who sent them" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Referred name <span className="text-danger">*</span></label>
        <input name="referred_name" required placeholder="New prospect" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Referred phone</label>
        <input name="referred_phone" type="tel" inputMode="tel" placeholder="(512) 555-0100" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Interested in</label>
        <input name="service_interest" placeholder="turf, fencing, court…" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Source</label>
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
          className="btn btn-primary disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add referral"}
        </button>
      </div>
      {state.error && <p className="text-xs text-danger sm:col-span-3">{state.error}</p>}
      {state.info && <p className="text-xs text-brand sm:col-span-3">{state.info}</p>}
    </form>
  );
}
