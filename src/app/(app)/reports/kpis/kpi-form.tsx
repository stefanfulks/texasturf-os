"use client";

import { useActionState } from "react";
import type { KpiEntry } from "@/lib/db-helpers.types";
import { saveKpis, type SaveKpisState } from "./actions";

const KPI_DEFINITIONS = [
  { key: "capacity_utilization_pct",  label: "Capacity Utilization",        unit: "%" },
  { key: "customer_satisfaction",     label: "Customer Satisfaction Score",  unit: "score (1–10)" },
  { key: "quote_to_install_days",     label: "Quote → Install Lead Time",    unit: "days" },
  { key: "quality_score_pct",         label: "Quality Pass Rate",            unit: "%" },
  { key: "on_time_delivery_pct",      label: "On-Time Delivery",             unit: "%" },
  { key: "crew_utilization_pct",      label: "Crew Utilization",             unit: "%" },
  { key: "gross_margin_pct",          label: "Gross Margin",                 unit: "%" },
] as const;

type Props = {
  entries: KpiEntry[];
  month: number;
  year: number;
};

const initialState: SaveKpisState = { error: null, success: false };

export function KpiForm({ entries, month, year }: Props) {
  const [state, formAction, isPending] = useActionState(saveKpis, initialState);

  const entryMap = new Map<string, KpiEntry>();
  for (const e of entries) entryMap.set(e.kpi_key, e);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="year" value={year} />

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {KPI_DEFINITIONS.map(({ key, label, unit }, idx) => {
          const existing = entryMap.get(key);
          return (
            <div
              key={key}
              className={`p-5 ${idx < KPI_DEFINITIONS.length - 1 ? "border-b border-zinc-100" : ""}`}
            >
              <div className="flex items-baseline gap-2 mb-3">
                <p className="text-sm font-semibold text-zinc-700">{label}</p>
                <span className="text-xs text-zinc-400">{unit}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor={`target_${key}`}
                    className="block text-xs text-zinc-500 mb-1 font-medium"
                  >
                    Target
                  </label>
                  <input
                    id={`target_${key}`}
                    name={`target_${key}`}
                    type="number"
                    step="any"
                    defaultValue={existing?.target_value ?? ""}
                    placeholder="—"
                    className="w-full text-sm border border-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`actual_${key}`}
                    className="block text-xs text-zinc-500 mb-1 font-medium"
                  >
                    Actual
                  </label>
                  <input
                    id={`actual_${key}`}
                    name={`actual_${key}`}
                    type="number"
                    step="any"
                    defaultValue={existing?.actual_value ?? ""}
                    placeholder="—"
                    className="w-full text-sm border border-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`notes_${key}`}
                    className="block text-xs text-zinc-500 mb-1 font-medium"
                  >
                    Notes (optional)
                  </label>
                  <input
                    id={`notes_${key}`}
                    name={`notes_${key}`}
                    type="text"
                    defaultValue={existing?.notes ?? ""}
                    placeholder="Context or explanation"
                    className="w-full text-sm border border-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {state.error && (
        <p className="text-sm text-red-600 font-medium">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-700 font-semibold">KPIs saved successfully.</p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="bg-zinc-900 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Saving…" : "Save KPIs"}
        </button>
      </div>
    </form>
  );
}
