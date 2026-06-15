"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Deal } from "@/lib/sales/types";
import { today } from "@/lib/sales/dates";
import { addNote, setNextStep } from "@/app/(app)/sales/actions";

/** Next-step editor + note logger for the deal Overview. Client-side because
 *  both call server actions; the page itself stays a server component. */
export function DealOverviewForms({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [nextStep, setNextStepDraft] = useState(deal.next_step ?? "");
  const [note, setNote] = useState("");
  const [savingStep, startSaveStep] = useTransition();
  const [savingNote, startSaveNote] = useTransition();

  function saveNextStep() {
    const trimmed = nextStep.trim();
    startSaveStep(async () => {
      await setNextStep(deal.id, trimmed || null, trimmed ? today() : null);
      router.refresh();
    });
  }

  function logNote() {
    const trimmed = note.trim();
    if (!trimmed) return;
    startSaveNote(async () => {
      await addNote(deal.id, trimmed);
      setNote("");
      router.refresh();
    });
  }

  return (
    <>
      <div className="card px-4 py-3.5">
        <div className="eyebrow mb-2">Next step</div>
        <div className="flex gap-2">
          <input
            value={nextStep}
            onChange={(e) => setNextStepDraft(e.target.value)}
            placeholder="What moves this deal forward?"
            className="field-input"
          />
          <button
            onClick={saveNextStep}
            disabled={savingStep}
            className="btn btn-primary btn-sm shrink-0"
          >
            Save
          </button>
        </div>
      </div>

      <div className="card px-4 py-3.5">
        <div className="eyebrow mb-2">Log a note</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Call recap, decision, objection…"
          className="field-input"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={logNote}
            disabled={!note.trim() || savingNote}
            className="btn btn-primary btn-sm"
          >
            Add to timeline
          </button>
        </div>
      </div>
    </>
  );
}
