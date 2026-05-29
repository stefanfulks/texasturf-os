"use client";

import { useState, useTransition } from "react";
import { adjustItemQuantity } from "./actions";

export function ItemAdjustButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const numDelta = Number(delta);
    if (!Number.isFinite(numDelta) || numDelta === 0) {
      setError("Enter a non-zero amount");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adjustItemQuantity(itemId, numDelta, reason || undefined);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setDelta("");
      setReason("");
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
      >
        Adjust
      </button>
    );
  }

  return (
    <div className="absolute right-4 top-full mt-1 w-72 z-10 rounded-lg border border-zinc-200 bg-white shadow-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-zinc-700">Adjust quantity — {itemName}</p>
      <input
        type="number"
        step="0.25"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        placeholder="e.g. +5 or -2"
        className="w-full text-sm border border-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        autoFocus
      />
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-full text-sm border border-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-900"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={isPending}
          className="text-xs font-medium bg-zinc-900 text-white px-3 py-1 rounded hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? "…" : "Apply"}
        </button>
      </div>
    </div>
  );
}
