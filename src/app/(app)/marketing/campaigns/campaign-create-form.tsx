"use client";

import { useActionState } from "react";
import { createCampaign, type ActionState } from "./actions";

const initial: ActionState = { error: null, success: false };
const field =
  "field-input";

const TYPES = [
  ["service_spotlight", "Service spotlight"],
  ["referral", "Referral"],
  ["seasonal", "Seasonal"],
  ["event", "Event"],
  ["other", "Other"],
] as const;

const SERVICE_LINES = [
  "turf", "xeriscape", "lot_clearing", "pavers", "tree_removal", "excavation",
  "stone_work", "site_prep", "concrete", "courts", "fencing", "welding", "landscape_design",
];

export function CampaignCreateForm() {
  const [state, formAction, isPending] = useActionState(createCampaign, initial);
  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-ink-3 mb-1">Name *</label>
        <input name="name" required placeholder="October Spotlight — Pavers" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Type</label>
        <select name="type" defaultValue="service_spotlight" className={field}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Service line</label>
        <select name="service_line" defaultValue="" className={field}>
          <option value="">—</option>
          {SERVICE_LINES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Starts on</label>
        <input type="date" name="starts_on" className={field} />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-ink-3 mb-1">Brief (markdown ok)</label>
        <textarea name="brief_md" rows={3} placeholder="Angle, audience, the kit…" className={field} />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={isPending} className="btn btn-primary disabled:opacity-50">
          {isPending ? "Creating…" : "Create campaign"}
        </button>
        {state.error && <span className="text-xs text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
