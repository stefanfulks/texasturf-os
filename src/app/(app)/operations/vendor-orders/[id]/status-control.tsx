"use client";

import { useActionState } from "react";
import { setStatus, type FormState } from "../actions";
import { STAGE_ORDER, stageLabel, stageBadge } from "../_lib/status";
import type { PoStatus } from "@/lib/db-helpers.types";

const initial: FormState = { error: null, success: false };

export function StatusControl({ id, current, canEdit }: { id: string; current: PoStatus; canEdit: boolean }) {
  const [state, formAction, isPending] = useActionState(setStatus, initial);

  if (!canEdit) {
    return <span className={`text-sm px-2.5 py-1 rounded-md font-medium ${stageBadge(current)}`}>{stageLabel(current)}</span>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={current} className="field-input btn-sm h-8 py-0 w-auto text-sm">
        {STAGE_ORDER.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
      </select>
      <button type="submit" disabled={isPending} className="btn btn-line btn-sm disabled:opacity-50">
        {isPending ? "…" : "Set"}
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
