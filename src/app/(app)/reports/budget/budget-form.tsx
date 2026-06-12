"use client";

import { useActionState } from "react";
import type { Budget } from "@/lib/db-helpers.types";
import { saveBudgets, type SaveBudgetsState } from "./actions";

const CATEGORIES = [
  { key: "subcontractors", label: "Subcontractors" },
  { key: "materials",      label: "Materials"      },
  { key: "labor",          label: "Labor"          },
  { key: "overhead",       label: "Overhead"       },
  { key: "equipment",      label: "Equipment"      },
  { key: "other",          label: "Other"          },
] as const;

type Props = {
  budgets: Budget[];
  month: number;
  year: number;
};

const initialState: SaveBudgetsState = { error: null, success: false };

export function BudgetForm({ budgets, month, year }: Props) {
  const [state, formAction, isPending] = useActionState(saveBudgets, initialState);

  const budgetMap = new Map<string, Budget>();
  for (const b of budgets) budgetMap.set(b.category, b);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="year" value={year} />

      <div className="rounded-xl border border-line bg-white overflow-hidden">
        {CATEGORIES.map(({ key, label }, idx) => {
          const existing = budgetMap.get(key);
          return (
            <div
              key={key}
              className={`p-5 ${idx < CATEGORIES.length - 1 ? "border-b border-line" : ""}`}
            >
              <p className="text-sm font-semibold text-ink-2 mb-3">{label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor={`amount_${key}`}
                    className="block text-xs text-ink-3 mb-1 font-medium"
                  >
                    Budget Amount ($)
                  </label>
                  <input
                    id={`amount_${key}`}
                    name={`amount_${key}`}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={existing?.budgeted_amount ?? ""}
                    placeholder="0.00"
                    className="w-full text-sm border border-line rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`notes_${key}`}
                    className="block text-xs text-ink-3 mb-1 font-medium"
                  >
                    Notes (optional)
                  </label>
                  <input
                    id={`notes_${key}`}
                    name={`notes_${key}`}
                    type="text"
                    defaultValue={existing?.notes ?? ""}
                    placeholder="e.g. 3 crews scheduled"
                    className="w-full text-sm border border-line rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {state.error && (
        <p className="text-sm text-danger font-medium">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-brand font-semibold">Budget saved successfully.</p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="bg-ink text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Saving…" : "Save Budget"}
        </button>
      </div>
    </form>
  );
}
