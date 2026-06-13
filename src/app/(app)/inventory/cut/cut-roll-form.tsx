"use client";

import { useActionState, useState } from "react";
import { Scissors } from "lucide-react";
import { cutRoll, type CutRollState } from "../rolls/actions";
import type { InvRoll } from "@/lib/db-helpers.types";

type ParentRollOption = Pick<
  InvRoll,
  | "id"
  | "tt_sku_tag_number"
  | "product_name"
  | "dye_lot"
  | "width_ft"
  | "current_length_ft"
  | "status"
>;

const initial: CutRollState = { error: null, success: false };
const field =
  "field-input";

function fmtFt(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ft`;
}

export function CutRollForm({
  parentRolls,
  initialRollId,
}: {
  parentRolls: ParentRollOption[];
  initialRollId: string;
}) {
  const [state, formAction, isPending] = useActionState<CutRollState, FormData>(
    cutRoll,
    initial,
  );
  const [selectedId, setSelectedId] = useState<string>(initialRollId);
  const [cutLength, setCutLength] = useState<string>("");

  const selectedRoll = parentRolls.find((r) => r.id === selectedId);
  const cutNum = parseFloat(cutLength);
  const validCut =
    !isNaN(cutNum) &&
    cutNum > 0 &&
    selectedRoll != null &&
    cutNum <= (selectedRoll.current_length_ft ?? 0);
  const remainder =
    selectedRoll != null && !isNaN(cutNum) && cutNum > 0
      ? (selectedRoll.current_length_ft ?? 0) - cutNum
      : null;

  return (
    <form action={formAction} className="space-y-6">
      {/* Step 1: Select parent */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-semibold text-ink">
            1. Select Parent Roll
          </h2>
          <span className="text-xs text-ink-4">
            {parentRolls.length} available
          </span>
        </div>
        <select
          name="parent_roll_id"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          required
          className={field}
        >
          <option value="">— Pick an available parent roll —</option>
          {parentRolls.map((r) => (
            <option key={r.id} value={r.id}>
              {r.tt_sku_tag_number ?? r.id.slice(0, 8)}
              {r.product_name ? ` · ${r.product_name}` : ""}
              {r.dye_lot ? ` · ${r.dye_lot}` : ""}
              {" · "}
              {fmtFt(r.current_length_ft)} remaining
            </option>
          ))}
        </select>

        {selectedRoll && (
          <div className="mt-3 rounded-lg bg-hover border border-line p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-mono font-bold text-ink">
                  {selectedRoll.tt_sku_tag_number ?? "—"}
                </p>
                <p className="text-sm text-ink-2">
                  {selectedRoll.product_name ?? "No product"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-ink-3">Dye Lot</p>
                <p className="font-medium text-ink">
                  {selectedRoll.dye_lot ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-ink-3">Width</p>
                <p className="font-medium text-ink">
                  {fmtFt(selectedRoll.width_ft)}
                </p>
              </div>
              <div>
                <p className="text-ink-3">Remaining</p>
                <p className="font-medium text-brand">
                  {fmtFt(selectedRoll.current_length_ft)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Cut length */}
      <div>
        <h2 className="text-sm font-semibold text-ink mb-2">
          2. Cut Length
        </h2>
        <input
          name="cut_length_ft"
          type="number" inputMode="decimal"
          step="0.01"
          min="0.01"
          value={cutLength}
          onChange={(e) => setCutLength(e.target.value)}
          placeholder="e.g. 10.5"
          required
          disabled={!selectedRoll}
          className={`${field} text-lg font-mono`}
        />
        <p className="mt-1 text-xs text-ink-3">
          Length in feet to cut from the parent roll.
        </p>
        {selectedRoll && !isNaN(cutNum) && cutNum > 0 && (
          <>
            {cutNum > (selectedRoll.current_length_ft ?? 0) ? (
              <p className="mt-2 text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">
                Cut length exceeds remaining {fmtFt(selectedRoll.current_length_ft)}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-brand bg-brand-tint border border-brand/30 rounded-lg px-3 py-2">
                Parent will have {fmtFt(remainder)} remaining after the cut.
                {remainder !== null && remainder <= 0 && (
                  <span className="block text-xs mt-0.5">
                    Parent will be marked <strong>consumed</strong>.
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">
          Notes (optional)
        </label>
        <textarea
          name="notes"
          rows={2}
          className={`${field} resize-none`}
          placeholder="Reason for the cut, where it's headed, etc."
        />
      </div>

      {state.error && (
        <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !validCut}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 transition-colors"
        >
          <Scissors className="h-4 w-4" />
          {isPending ? "Cutting…" : "Cut Roll"}
        </button>
      </div>
    </form>
  );
}
