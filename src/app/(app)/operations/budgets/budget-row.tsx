"use client";

import { useState, useTransition } from "react";
import { updateBudget, deleteBudget } from "@/lib/warehouse/actions";
import type { BudgetWithSpend } from "@/lib/warehouse/queries";

function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const field =
  "w-full text-sm border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";

/**
 * A single budget row. Default state shows the period + amount + spend bar.
 * Click "Edit" to inline-swap to editable inputs. Save submits updateBudget.
 */
export function BudgetRow({ budget }: { budget: BudgetWithSpend }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pct =
    budget.amount_cents > 0
      ? Math.min(100, Math.round((budget.spent_cents / budget.amount_cents) * 100))
      : 0;
  const over = budget.spent_cents > budget.amount_cents;

  async function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateBudget(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  async function handleDelete(formData: FormData) {
    if (!confirm("Delete this budget?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteBudget(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (editing) {
    return (
      <tr className="border-t border-zinc-200 bg-zinc-50">
        <td colSpan={6} className="px-3 py-3">
          <form action={handleUpdate} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={budget.id} />
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-500">Start</label>
              <input type="date" name="period_start" defaultValue={budget.period_start} required className={field} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-500">End</label>
              <input type="date" name="period_end" defaultValue={budget.period_end} required className={field} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-500">Amount (USD)</label>
              <input
                type="number" step="0.01" min="0.01"
                name="amount"
                defaultValue={(budget.amount_cents / 100).toFixed(2)}
                required
                className={`${field} w-32`}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] uppercase tracking-wide text-zinc-500">Notes</label>
              <input name="notes" defaultValue={budget.notes ?? ""} placeholder="Optional" className={field} />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setError(null); }}
                disabled={isPending}
                className="px-2 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
              >
                Cancel
              </button>
            </div>
            {error && (
              <p className="basis-full text-xs text-red-700">{error}</p>
            )}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-zinc-200 hover:bg-zinc-50">
      <td className="px-3 py-2 tabular-nums whitespace-nowrap">
        {budget.period_start} → {budget.period_end}
        {budget.is_active && (
          <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800 uppercase tracking-wide">
            Active
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtUSD(budget.amount_cents)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtUSD(budget.spent_cents)}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className={"tabular-nums " + (over ? "text-red-700 font-medium" : "text-zinc-700")}>
            {pct}%
          </span>
          <div className="h-1.5 w-16 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={"h-full " + (over ? "bg-red-500" : "bg-zinc-900")}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-zinc-600 max-w-xs truncate">{budget.notes ?? "—"}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-zinc-700 hover:text-zinc-900"
          >
            Edit
          </button>
          <form action={handleDelete}>
            <input type="hidden" name="id" value={budget.id} />
            <button
              type="submit"
              disabled={isPending}
              className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Delete
            </button>
          </form>
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-700">{error}</p>
        )}
      </td>
    </tr>
  );
}
