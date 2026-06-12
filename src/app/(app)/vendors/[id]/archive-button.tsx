"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { archiveVendor, unarchiveVendor, type ArchiveVendorState } from "../actions";

const initial: ArchiveVendorState = { error: null, success: false };

export function VendorArchiveButton({
  vendorId,
  archived,
}: {
  vendorId: string;
  /** True when vendor.active === false (i.e. archived/inactive). */
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const action = archived ? unarchiveVendor : archiveVendor;
  const [state, formAction, isPending] = useActionState(action, initial);

  if (state.success) setTimeout(() => router.refresh(), 0);

  if (archived) {
    return (
      <form action={formAction}>
        <input type="hidden" name="vendor_id" value={vendorId} />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-xl border border-line-strong bg-white text-sm font-semibold text-ink-2 hover:border-line-strong disabled:opacity-50 transition-colors"
        >
          {isPending ? "Restoring…" : "Restore vendor"}
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
        Archive vendor
      </button>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="vendor_id" value={vendorId} />
      <span className="text-xs text-ink-2">Archive this vendor?</span>
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
