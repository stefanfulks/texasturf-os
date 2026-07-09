"use client";

import { useState, useActionState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import { createCampaign, aiDraftCampaignBrief, type ActionState } from "./actions";

const initial: ActionState = { error: null, success: false };
const field = "field-input";

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

export function CampaignCreateForm({ aiEnabled }: { aiEnabled: boolean }) {
  const [state, formAction, isPending] = useActionState(createCampaign, initial);

  // Controlled so the AI draft can prefill; user reviews, then hits Create.
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [notes, setNotes] = useState("");

  const [goal, setGoal] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function draftWithAi() {
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await aiDraftCampaignBrief(goal);
      if (res.error || !res.brief) {
        setAiNote({ kind: "error", text: res.error ?? "Generation failed." });
        return;
      }
      const b = res.brief;
      if (!name.trim()) setName(b.name);
      if (!objective.trim()) setObjective(b.objective);
      if (!audience.trim()) setAudience(b.audience);
      if (!offer.trim()) setOffer(b.offer);
      if (!nextAction.trim()) setNextAction(b.next_action);
      if (!notes.trim()) setNotes(b.notes);
      setAiNote({ kind: "ok", text: "Brief drafted — review the fields, then Create." });
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Draft with AI */}
      <div className="rounded-xl border border-line bg-hover/40 p-4 space-y-3">
        <p className="eyebrow flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Draft the brief with AI
        </p>
        {!aiEnabled ? (
          <p className="flex items-start gap-2 text-xs text-ink-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warn" />
            AI provider missing — set ANTHROPIC_API_KEY to enable drafting. The form
            below still works by hand.
          </p>
        ) : (
          <>
            <textarea
              className="field-input min-h-16"
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. push putting greens to golf-obsessed homeowners before Father's Day"
              disabled={aiBusy}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-line btn-sm disabled:opacity-50"
                onClick={draftWithAi}
                disabled={aiBusy || goal.trim().length < 3}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {aiBusy ? "Drafting…" : "Draft brief"}
              </button>
              {aiNote && (
                <span className={`text-xs ${aiNote.kind === "error" ? "text-danger" : "text-brand"}`}>
                  {aiNote.text}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-3 mb-1">Name <span className="text-danger">*</span></label>
          <input name="name" required placeholder="October Spotlight — Pavers" className={field} value={name} onChange={(e) => setName(e.target.value)} />
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
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Objective</label>
          <input name="objective" placeholder="What does success look like?" className={field} value={objective} onChange={(e) => setObjective(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-3 mb-1">Audience</label>
          <input name="audience" placeholder="Who exactly, and what do they want?" className={field} value={audience} onChange={(e) => setAudience(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Offer</label>
          <input name="offer" placeholder="The hook customers respond to" className={field} value={offer} onChange={(e) => setOffer(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Next action</label>
          <input name="next_action" placeholder="The single next step this week" className={field} value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-3 mb-1">Notes — channels &amp; angles</label>
          <textarea name="notes" rows={3} placeholder="Channels, creative angles, which pillars feed it…" className={field} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-3 mb-1">Brief (markdown ok)</label>
          <textarea name="brief_md" rows={3} placeholder="Anything else — the long-form brief…" className={field} />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" disabled={isPending} className="btn btn-primary disabled:opacity-50">
            {isPending ? "Creating…" : "Create campaign"}
          </button>
          {state.error && <span className="text-xs text-danger">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
