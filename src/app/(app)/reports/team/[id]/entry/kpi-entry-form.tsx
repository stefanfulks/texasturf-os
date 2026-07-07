"use client";

import { useActionState } from "react";
import type { TeamMember, TeamKpiDefinition, TeamKpiEntry } from "@/lib/db-helpers.types";
import { saveTeamKpis, type SaveKpisState } from "./actions";

type Props = {
  member: TeamMember;
  definitions: TeamKpiDefinition[];
  entries: TeamKpiEntry[];
  month: number;
  year: number;
};

const initialState: SaveKpisState = { error: null, success: false };

export function TeamKpiEntryForm({ member, definitions, entries, month, year }: Props) {
  const [state, formAction, isPending] = useActionState(saveTeamKpis, initialState);

  const entryMap = new Map<string, TeamKpiEntry>();
  for (const e of entries) entryMap.set(e.kpi_key, e);

  const kpiKeys = definitions.map((d) => d.kpi_key).join(",");

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <form action={formAction} className="space-y-4">
      {/* Hidden fields */}
      <input type="hidden" name="member_id" value={member.id} />
      <input type="hidden" name="period_month" value={month} />
      <input type="hidden" name="period_year" value={year} />
      <input type="hidden" name="kpi_keys" value={kpiKeys} />

      {/* Period info banner */}
      <div className="rounded-xl border border-line bg-hover px-5 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-2">
          Period: <span className="font-semibold text-ink">{monthLabel}</span>
        </span>
        <span className="text-xs text-ink-3">
          {entries.filter((e) => e.actual_value !== null).length} of {definitions.length} KPIs entered
        </span>
      </div>

      {/* KPI rows */}
      <div className="card overflow-hidden">
        {definitions.map((def, idx) => {
          const existing = entryMap.get(def.kpi_key);
          return (
            <div
              key={def.id}
              className={`p-5 ${idx < definitions.length - 1 ? "border-b border-line" : ""}`}
            >
              <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                <p className="text-sm font-semibold text-ink">{def.kpi_label}</p>
                {def.unit && (
                  <span className="text-xs text-ink-4 font-medium">{def.unit}</span>
                )}
                {def.lower_is_better && (
                  <span className="text-xs text-ink-4 italic">lower is better</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Target (read-only display) */}
                <div>
                  <p className="text-xs text-ink-3 mb-1 font-medium">Target</p>
                  <div className="w-full text-sm border border-line rounded-xl px-4 py-2.5 bg-hover text-ink-3 font-medium">
                    {Number(def.target_value).toLocaleString("en-US")}{def.unit ? ` ${def.unit}` : ""}
                  </div>
                </div>

                {/* Actual (editable) */}
                <div>
                  <label
                    htmlFor={`actual_${def.kpi_key}`}
                    className="block text-xs text-ink-3 mb-1 font-medium"
                  >
                    Actual
                  </label>
                  <input
                    id={`actual_${def.kpi_key}`}
                    name={`actual_${def.kpi_key}`}
                    type="number" inputMode="decimal"
                    step="any"
                    defaultValue={existing?.actual_value ?? ""}
                    placeholder="Enter value"
                    className="w-full text-sm border border-line rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label
                    htmlFor={`notes_${def.kpi_key}`}
                    className="block text-xs text-ink-3 mb-1 font-medium"
                  >
                    Notes (optional)
                  </label>
                  <input
                    id={`notes_${def.kpi_key}`}
                    name={`notes_${def.kpi_key}`}
                    type="text"
                    defaultValue={existing?.notes ?? ""}
                    placeholder="Context or explanation"
                    className="w-full text-sm border border-line rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status messages */}
      {state.error && (
        <p className="text-sm text-danger font-medium">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-brand font-semibold">
          {state.savedCount !== undefined
            ? `Saved ${state.savedCount} KPI${state.savedCount !== 1 ? "s" : ""} successfully.`
            : "KPIs saved successfully."}
        </p>
      )}

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : "Save KPIs"}
        </button>
      </div>
    </form>
  );
}
