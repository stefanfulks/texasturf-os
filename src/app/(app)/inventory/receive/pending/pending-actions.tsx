"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { confirmPendingRoll, rejectPendingRoll } from "../actions";

export function PendingRollActions({
  rollId,
  rollTag,
}: {
  rollId: string;
  rollTag: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("roll_id", rollId);
      const result = await confirmPendingRoll(
        { error: null, success: false },
        fd,
      );
      if (result.error) setError(result.error);
    });
  };

  const handleReject = () => {
    setError(null);
    if (!reason.trim()) {
      setError("Reason is required to reject.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("roll_id", rollId);
      fd.append("reason", reason.trim());
      const result = await rejectPendingRoll(
        { error: null, success: false },
        fd,
      );
      if (result.error) setError(result.error);
      else setShowReject(false);
    });
  };

  if (showReject) {
    return (
      <div className="inline-flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={rollTag ? `Reason for ${rollTag}` : "Reason"}
            className="w-48 text-xs border border-line rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-line-strong"
            autoFocus
          />
          <button
            type="button"
            onClick={handleReject}
            disabled={isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-danger text-white rounded-lg hover:bg-danger disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => {
              setShowReject(false);
              setReason("");
              setError(null);
            }}
            className="text-xs text-ink-3 hover:text-ink"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:bg-brand disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" aria-hidden="true" /> Confirm
      </button>
      <button
        type="button"
        onClick={() => setShowReject(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-danger bg-danger-tint border border-danger/30 rounded-lg hover:bg-danger-tint disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" /> Reject
      </button>
      {error && <span className="text-xs text-danger ml-2">{error}</span>}
    </div>
  );
}
