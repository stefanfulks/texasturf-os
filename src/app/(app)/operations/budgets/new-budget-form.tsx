"use client";

import { useMemo, useState, useTransition } from "react";
import { createBudget } from "@/lib/warehouse/actions";

const field =
  "field-input";

/**
 * Inline "+ Add budget" form. Collapsed by default; expands into a row of
 * inputs with sensible date defaults (start of current month → end of
 * current month).
 */
export function NewBudgetForm({
  kind,
}: {
  kind: "vehicle_maintenance" | "tool_purchases";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Default period: current calendar month.
  const defaults = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const fmt = (x: Date) => {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
    };
    return { start: fmt(start), end: fmt(end) };
  }, []);

  async function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createBudget(formData);
        // Server action revalidates; close the form so the new row is visible.
        setOpen(false);
        // Reset form fields explicitly so a re-open shows defaults again.
        (document.activeElement as HTMLElement | null)?.blur();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-line-strong bg-white px-3 py-2 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
      >
        + Add budget
      </button>
    );
  }

  return (
    <form
      action={handleCreate}
      className="rounded-xl border border-line bg-white p-3 flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="kind" value={kind} />
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-ink-3">Start</label>
        <input type="date" name="period_start" defaultValue={defaults.start} required className={field} />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-ink-3">End</label>
        <input type="date" name="period_end" defaultValue={defaults.end} required className={field} />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-ink-3">Amount (USD)</label>
        <input
          type="number" inputMode="decimal"
          step="0.01"
          min="0.01"
          name="amount"
          placeholder="2500.00"
          required
          className={`${field} w-32`}
        />
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-[10px] uppercase tracking-wide text-ink-3">Notes</label>
        <input name="notes" placeholder="Optional" className={field} />
      </div>
      <div className="flex items-center gap-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-strong disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
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
  );
}
