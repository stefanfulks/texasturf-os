"use client";

import { useState, useTransition } from "react";
import { signOff, clearSignOff } from "@/lib/kpi-log/actions";

const initial = { error: null, success: false };

export function SignOffButton({
  entryId,
  signed,
  signerName,
  signedAt,
  mgmtNotes,
}: {
  entryId: string;
  signed: boolean;
  signerName: string | null;
  signedAt: string | null;
  mgmtNotes: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSignOff = (formData: FormData) => {
    startTransition(async () => {
      const result = await signOff(initial, formData);
      if (result.success) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  };

  if (signed) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand">
          ✓ Signed
        </span>
        {signerName && (
          <span className="text-[10px] text-ink-4">
            {signerName}
            {signedAt && ` · ${new Date(signedAt).toLocaleDateString()}`}
          </span>
        )}
        {mgmtNotes && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[10px] text-ink-3 underline hover:text-ink-2"
          >
            view notes
          </button>
        )}
        {open && (
          <UnsignOffPanel
            entryId={entryId}
            mgmtNotes={mgmtNotes}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-warn/40 bg-warn-tint px-2.5 py-0.5 text-[11px] font-medium text-warn hover:border-warn"
      >
        Sign off
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form
            action={handleSignOff}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-3"
          >
            <h3 className="text-base font-semibold">Sign off on entry</h3>
            <p className="text-xs text-ink-3">
              Confirms management has reviewed this entry. Add any notes to the team.
            </p>
            <input type="hidden" name="id" value={entryId} />
            <textarea
              name="mgmt_notes"
              rows={3}
              placeholder="Management notes (optional)"
              className="field-input resize-none w-full"
            />
            {error && (
              <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn btn-primary disabled:opacity-50"
              >
                {isPending ? "Signing…" : "Sign off"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function UnsignOffPanel({
  entryId,
  mgmtNotes,
  onClose,
}: {
  entryId: string;
  mgmtNotes: string | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-3">
        <h3 className="text-base font-semibold">Management notes</h3>
        {mgmtNotes ? (
          <p className="rounded-lg border border-line bg-sunken p-3 text-sm text-ink-2 whitespace-pre-wrap">
            {mgmtNotes}
          </p>
        ) : (
          <p className="text-sm text-ink-4">No notes attached.</p>
        )}
        {err && (
          <p className="text-sm text-danger bg-danger-tint border border-danger/30 rounded-lg px-3 py-2">
            {err}
          </p>
        )}
        <div className="flex justify-between gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              const res = await clearSignOff(entryId);
              setBusy(false);
              if (res.error) setErr(res.error);
              else onClose();
            }}
            className="px-3 py-1.5 text-xs font-medium text-danger hover:underline disabled:opacity-50"
          >
            {busy ? "Reopening…" : "Reopen for review"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
