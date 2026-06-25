"use client";

import { useState, useTransition } from "react";
import { resolveUnmatched, convertUnmatchedToDeal } from "@/app/(app)/sales/inbox/actions";

export interface UnmatchedRow {
  id: string;
  from_number: string;
  recording_url: string | null;
  duration_sec: number | null;
  transcript: string | null;
  occurred_at: string;
}

export function UnmatchedCallsTable({ rows }: { rows: UnmatchedRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-3 py-4">
        No unmatched voicemails. When someone calls the TexasTurf number from a phone that isn&apos;t tied to a sales contact, the voicemail will land here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <UnmatchedRowItem key={row.id} row={row} />
      ))}
    </ul>
  );
}

function UnmatchedRowItem({ row }: { row: UnmatchedRow }) {
  const [open, setOpen] = useState<"none" | "convert" | "resolve">("none");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [note, setNote] = useState("");

  const onConvert = () => {
    setError(null);
    start(async () => {
      const r = await convertUnmatchedToDeal(row.id, { name, company, phone: row.from_number });
      if (!r.ok) setError(r.reason);
    });
  };

  const onResolve = () => {
    setError(null);
    start(async () => {
      const r = await resolveUnmatched(row.id, note);
      if (!r.ok) setError(r.reason);
    });
  };

  return (
    <li className="py-3">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-medium text-ink">{row.from_number}</span>
        <span className="text-xs text-ink-3">
          {new Date(row.occurred_at).toLocaleString()} · {row.duration_sec ?? 0}s
        </span>
      </div>

      {row.recording_url && (
        <audio src={row.recording_url} controls className="mt-2 w-full max-w-md h-9" preload="none" />
      )}

      {row.transcript && (
        <p className="mt-2 text-sm text-ink-2 italic">&ldquo;{row.transcript}&rdquo;</p>
      )}

      <div className="mt-2 flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setOpen(open === "convert" ? "none" : "convert")}
          className="rounded-md border border-line bg-surface px-2 py-1 text-ink-2 hover:bg-hover"
        >
          Convert to deal
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "resolve" ? "none" : "resolve")}
          className="rounded-md border border-line bg-surface px-2 py-1 text-ink-2 hover:bg-hover"
        >
          Mark handled
        </button>
      </div>

      {open === "convert" && (
        <div className="mt-2 rounded-md border border-line bg-surface p-3 space-y-2">
          <input
            type="text"
            placeholder="Contact name (required)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-line px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="Company (optional)"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full rounded-md border border-line px-2 py-1 text-sm"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onConvert}
              disabled={pending || !name.trim()}
              className="rounded-md bg-brand px-3 py-1 text-xs font-medium text-on-brand disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create lead deal"}
            </button>
          </div>
        </div>
      )}

      {open === "resolve" && (
        <div className="mt-2 rounded-md border border-line bg-surface p-3 space-y-2">
          <input
            type="text"
            placeholder="Note (optional, e.g. 'wrong number')"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-line px-2 py-1 text-sm"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onResolve}
              disabled={pending}
              className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-canvas disabled:opacity-50"
            >
              {pending ? "Marking…" : "Mark handled"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </li>
  );
}
