"use client";

import { useState, useTransition } from "react";
import { Sparkles, Save, AlertTriangle } from "lucide-react";
import { updateCampaignBrief, aiDraftCampaignBrief, type CampaignBriefPatch } from "../actions";

type BriefFields = {
  objective: string | null;
  audience: string | null;
  offer: string | null;
  next_action: string | null;
  notes: string | null;
};

/** Structured brief on the campaign detail page. "Fill with AI" only fills
 * EMPTY fields; nothing persists until Save. */
export function BriefEditor({
  id,
  name,
  type,
  serviceLine,
  initial,
  aiEnabled,
}: {
  id: string;
  name: string;
  type: string;
  serviceLine: string | null;
  initial: BriefFields;
  aiEnabled: boolean;
}) {
  const [objective, setObjective] = useState(initial.objective ?? "");
  const [audience, setAudience] = useState(initial.audience ?? "");
  const [offer, setOffer] = useState(initial.offer ?? "");
  const [nextAction, setNextAction] = useState(initial.next_action ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  async function fillWithAi() {
    setAiBusy(true);
    setNote(null);
    try {
      const goal = `Campaign "${name}" (type: ${type.replace(/_/g, " ")}${serviceLine ? `, service line: ${serviceLine.replace(/_/g, " ")}` : ""})`;
      const res = await aiDraftCampaignBrief(goal, id);
      if (res.error || !res.brief) {
        setNote({ kind: "error", text: res.error ?? "Generation failed." });
        return;
      }
      const b = res.brief;
      let filled = 0;
      if (!objective.trim()) { setObjective(b.objective); filled++; }
      if (!audience.trim()) { setAudience(b.audience); filled++; }
      if (!offer.trim()) { setOffer(b.offer); filled++; }
      if (!nextAction.trim()) { setNextAction(b.next_action); filled++; }
      if (!notes.trim()) { setNotes(b.notes); filled++; }
      setNote(
        filled === 0
          ? { kind: "ok", text: "Every field already has text — clear one first to regenerate it." }
          : { kind: "ok", text: `Filled ${filled} empty field${filled === 1 ? "" : "s"} — review, then Save.` },
      );
    } finally {
      setAiBusy(false);
    }
  }

  function save() {
    setNote(null);
    const patch: CampaignBriefPatch = {
      objective: objective.trim() || null,
      audience: audience.trim() || null,
      offer: offer.trim() || null,
      next_action: nextAction.trim() || null,
      notes: notes.trim() || null,
    };
    startTransition(async () => {
      const res = await updateCampaignBrief(id, patch);
      if (res.error) setNote({ kind: "error", text: res.error });
      else setNote({ kind: "ok", text: "Saved." });
    });
  }

  const field = "field-input";

  return (
    <section className="card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Brief</h2>
        {aiEnabled ? (
          <button
            type="button"
            className="btn btn-line btn-sm disabled:opacity-50"
            onClick={fillWithAi}
            disabled={aiBusy || pending}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {aiBusy ? "Generating…" : "Fill with AI"}
          </button>
        ) : (
          <span className="chip chip-warn !text-[10px] flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> AI provider missing
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-3 mb-1">Next action — this week</label>
          <input className={field} value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="The single next step, starts with a verb" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Objective</label>
          <input className={field} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="What does success look like?" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Offer</label>
          <input className={field} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="The hook customers respond to" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-3 mb-1">Audience</label>
          <input className={field} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Who exactly, and what do they want?" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-3 mb-1">Notes — channels &amp; angles</label>
          <textarea className={`${field} min-h-20`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Channels, creative angles, which pillars feed it…" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary btn-sm disabled:opacity-50" onClick={save} disabled={pending || aiBusy}>
          <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save brief"}
        </button>
        {note && (
          <span className={`text-xs ${note.kind === "error" ? "text-danger" : "text-brand"}`}>{note.text}</span>
        )}
      </div>
    </section>
  );
}
