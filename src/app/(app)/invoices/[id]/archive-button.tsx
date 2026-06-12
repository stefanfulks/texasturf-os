"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveInvoice, unarchiveInvoice, type ArchiveInvoiceState } from "../actions";

const initial: ArchiveInvoiceState = { error: null, success: false };

export function ArchiveButton({
  invoiceId,
  archived,
}: {
  invoiceId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const action = archived ? unarchiveInvoice : archiveInvoice;
  const [state, formAction, isPending] = useActionState(action, initial);

  if (state.success) {
    // Refresh once after a successful action
    setTimeout(() => router.refresh(), 0);
  }

  if (archived) {
    return (
      <form action={formAction}>
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-xl border border-line-strong bg-white text-sm font-semibold text-ink-2 hover:border-line-strong disabled:opacity-50 transition-colors"
        >
          {isPending ? "Restoring…" : "Unarchive"}
        </button>
        {state.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
      </form>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="px-4 py-2 rounded-xl border border-danger/30 bg-white text-sm font-semibold text-danger hover:border-danger/30 hover:bg-danger-tint transition-colors"
      >
        Archive
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <span className="text-xs text-ink-2">Archive this invoice?</span>
      <button
        type="submit"
        disabled={isPending}
        className="px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-semibold hover:bg-danger disabled:opacity-50 transition-colors"
      >
        {isPending ? "Archiving…" : "Yes, archive"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="px-3 py-1.5 rounded-lg border border-line bg-white text-xs font-semibold text-ink-2 hover:border-line-strong transition-colors"
      >
        Cancel
      </button>
      {state.error && <span className="ml-1 text-xs text-danger">{state.error}</span>}
    </form>
  );
}
