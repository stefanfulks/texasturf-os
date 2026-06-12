"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { restockReturnedRoll, markReturnedDamaged } from "../actions";

export function PendingReturnActions({ rollId }: { rollId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (
    action: typeof restockReturnedRoll | typeof markReturnedDamaged,
  ) => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("roll_id", rollId);
      const result = await action({ error: null, success: false }, fd);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => run(restockReturnedRoll)}
        disabled={isPending}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" aria-hidden="true" /> Restock
      </button>
      <button
        type="button"
        onClick={() => run(markReturnedDamaged)}
        disabled={isPending}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-danger bg-danger-tint border border-danger/30 rounded-lg hover:bg-danger-tint disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" /> Damaged
      </button>
      {error && <span className="text-xs text-danger ml-2">{error}</span>}
    </div>
  );
}
