"use client";

import { useState, useTransition } from "react";
import { updateBudget, deleteBudget } from "@/lib/warehouse/actions";
import type { BudgetWithSpend } from "@/lib/warehouse/queries";

function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const field =
  "field-input";

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
      <tr className="border-t border-line bg-hover">
        <td colSpan={6} className="px-3 py-3">
          <form action={handleUpdate} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={budget.id} />
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-ink-3">Start</label>
              <input type="date" name="period_start" defaultValue={budget.period_start} required className={field} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-ink-3">End</label>
              <input type="date" name="period_end" defaultValue={budget.period_end} required className={field} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-ink-3">Amount (USD)</label>
              <input
                type="number" inputMode="decimal" step="0.01" min="0.01"
                name="amount"
                defaultValue={(budget.amount_cents / 100).toFixed(2)}
                required
                className={`${field} w-32`}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] uppercase tracking-wide text-ink-3">Notes</label>
              <input name="notes" defaultValue={budget.notes ?? ""} placeholder="Optional" className={field} />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-strong disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setError(null); }}
                disabled={isPending}
                className="px-2 py-1.5 text-xs text-ink-2 hover:text-ink"
              >
                Cancel
              </button>
            </div>
            {error && (
              <p className="basis-full text-xs text-danger">{error}</p>
            )}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line hover:bg-hover">
      <td className="px-3 py-2 tabular-nums whitespace-nowrap">
        {budget.period_start} → {budget.period_end}
        {budget.is_active && (
          <span className="ml-2 inline-block rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-medium text-brand uppercase tracking-wide">
            Active
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtUSD(budget.amount_cents)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtUSD(budget.spent_cents)}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className={"tabular-nums " + (over ? "text-danger font-medium" : "text-ink-2")}>
            {pct}%
          </span>
          <div className="h-1.5 w-16 rounded-full bg-sunken overflow-hidden">
            <div
              className={"h-full " + (over ? "bg-danger" : "bg-ink")}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-ink-2 max-w-xs truncate">{budget.notes ?? "—"}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-ink-2 hover:text-ink"
          >
            Edit
          </button>
          <form action={handleDelete}>
            <input type="hidden" name="id" value={budget.id} />
            <button
              type="submit"
              disabled={isPending}
              className="text-xs font-medium text-danger hover:text-danger disabled:opacity-50"
            >
              Delete
            </button>
          </form>
        </div>
        {error && (
          <p className="mt-1 text-xs text-danger">{error}</p>
        )}
      </td>
    </tr>
  );
}
