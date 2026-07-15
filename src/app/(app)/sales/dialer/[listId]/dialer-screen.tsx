"use client";

/**
 * The working dialer screen (spec §7): person card → Call → disposition →
 * Next. Keyboard cadence: C = call, 1–8 = outcome, S = skip, N/Enter = next.
 * Bridge-flow copy is explicit — the rep's phone rings first.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Phone,
  SkipForward,
} from "lucide-react";
import { placeCall, logDisposition, skipItem, setListStatus } from "@/lib/dialer/actions";
import type { CallListItem } from "@/lib/db-helpers.types";
import {
  CALL_OUTCOMES,
  TARGET_TYPE_LABELS,
  type CallOutcome,
  type DialTargetType,
} from "@/lib/dialer/types";

type Props = { listId: string; initialItems: CallListItem[] };

export function DialerScreen({ listId, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [activeId, setActiveId] = useState<string | null>(
    () => initialItems.find((i) => i.status === "pending")?.id ?? null,
  );
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const active = useMemo(
    () => items.find((i) => i.id === activeId) ?? null,
    [items, activeId],
  );
  const pendingCount = items.filter((i) => i.status === "pending").length;
  const doneCount = items.length - pendingCount;

  const startCall = useCallback(async () => {
    if (!active || calling) return;
    setError(null);
    setCalling(true);
    const res = await placeCall(active.id);
    setCalling(false);
    if (res.ok) {
      setAttemptId(res.attemptId);
    } else {
      setError(res.reason);
    }
  }, [active, calling]);

  const advance = useCallback(() => {
    setAttemptId(null);
    setOutcome(null);
    setNote("");
    setCallbackAt("");
    setError(null);
    // Rotate: next pending after the current position, wrapping around. The
    // active item is excluded, so its (just-updated) status can't re-match.
    const idx = items.findIndex((i) => i.id === activeId);
    const rotated = [...items.slice(idx + 1), ...items.slice(0, Math.max(idx, 0))];
    setActiveId(rotated.find((i) => i.status === "pending")?.id ?? null);
  }, [items, activeId]);

  const saveAndNext = useCallback(() => {
    if (!active || !outcome || saving) return;
    setError(null);
    startSaving(async () => {
      const res = await logDisposition({
        callListItemId: active.id,
        attemptId,
        outcome,
        note: note || null,
        callbackAt: callbackAt ? new Date(callbackAt).toISOString() : null,
      });
      if (!res.ok) {
        setError(res.reason);
        return;
      }
      const terminal = CALL_OUTCOMES.find((o) => o.value === outcome)?.terminal;
      setItems((prev) =>
        prev.map((i) =>
          i.id === active.id
            ? {
                ...i,
                status: terminal ? "done" : "called",
                attempts: i.attempts + 1,
                last_outcome: outcome,
              }
            : i,
        ),
      );
      advance();
    });
  }, [active, outcome, attemptId, note, callbackAt, saving, advance]);

  const skip = useCallback(async () => {
    if (!active) return;
    const res = await skipItem(active.id);
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === active.id ? { ...i, status: "skipped" } : i)),
      );
      advance();
    }
  }, [active, advance]);

  // Keyboard cadence — disabled while typing in the note/date fields.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        void startCall();
      } else if (e.key >= "1" && e.key <= "8") {
        e.preventDefault();
        setOutcome(CALL_OUTCOMES[Number(e.key) - 1].value);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        void skip();
      } else if (e.key === "n" || e.key === "N" || e.key === "Enter") {
        e.preventDefault();
        saveAndNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startCall, skip, saveAndNext]);

  if (!items.length) {
    return (
      <div className="panel">
        <div className="empty-state">
          <p className="empty-state-title">This list is empty</p>
          <p className="empty-state-body">Add people from the list builder.</p>
        </div>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="panel">
        <div className="empty-state">
          <span className="medallion medallion-brand">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="empty-state-title">List complete 🎉</p>
          <p className="empty-state-body">
            All {items.length} entries handled. Mark it done to clear it off
            the board.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-3"
            onClick={() => void setListStatus(listId, "completed")}
          >
            Mark list completed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="h-1.5 grow overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${items.length ? Math.round((doneCount / items.length) * 100) : 0}%` }}
            />
          </div>
          <p className="shrink-0 text-xs font-medium text-ink-3">
            {doneCount} / {items.length} · {pendingCount} left
          </p>
        </div>

        {/* Person card */}
        <div className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow mb-1">
                {TARGET_TYPE_LABELS[active.target_type as DialTargetType] ?? active.target_type}
                {active.attempts > 0 && ` · attempt ${active.attempts + 1}`}
              </p>
              <h2 className="truncate text-xl font-semibold text-ink">
                {active.snapshot_name ?? "Unknown"}
              </h2>
              {active.snapshot_company && (
                <p className="text-sm text-ink-2">{active.snapshot_company}</p>
              )}
              <p className="num mt-1 text-lg text-ink">{active.snapshot_phone ?? "no phone"}</p>
              {active.last_outcome && (
                <p className="mt-1 text-xs text-ink-3">
                  Last outcome: {active.last_outcome.replace(/_/g, " ")}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void startCall()}
                disabled={calling || !active.snapshot_phone}
              >
                {calling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                {attemptId ? "Call again" : "Call"}
                <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">C</kbd>
              </button>
              <p className="max-w-[16rem] text-right text-xs text-ink-3">
                Your phone rings first, then we connect them with the TexasTurf caller ID.
              </p>
            </div>
          </div>
          {attemptId && (
            <p className="mt-3 rounded-md bg-brand-tint px-3 py-2 text-sm text-ink">
              Call placed — answer your phone. Log the outcome below when you hang up.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>

        {/* Disposition bar */}
        <div className="panel p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            Outcome <span className="font-normal normal-case">(keys 1–8)</span>
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {CALL_OUTCOMES.map((o, i) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOutcome(o.value)}
                className={`btn btn-sm justify-start ${
                  outcome === o.value ? "btn-primary" : ""
                }`}
              >
                <span className="mr-1 text-[10px] text-ink-3">{i + 1}</span>
                {o.label}
              </button>
            ))}
          </div>
          {outcome === "callback_scheduled" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-3">Callback time</span>
              <input
                type="datetime-local"
                className="field-input"
                value={callbackAt}
                onChange={(e) => setCallbackAt(e.target.value)}
              />
            </label>
          )}
          <textarea
            className="field-input w-full"
            rows={2}
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="btn btn-sm" onClick={() => void skip()}>
              <SkipForward className="h-3.5 w-3.5" /> Skip
              <kbd className="ml-1 rounded bg-sunken px-1 text-[10px]">S</kbd>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!outcome || saving}
              onClick={saveAndNext}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save &amp; next <ChevronRight className="h-4 w-4" />
              <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">N</kbd>
            </button>
          </div>
        </div>
      </div>

      {/* Up next */}
      <div className="panel h-fit">
        <div className="panel-head">
          <p className="text-sm font-semibold text-ink">Up next</p>
        </div>
        <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
          {items
            .filter((i) => i.status === "pending" && i.id !== active.id)
            .slice(0, 20)
            .map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-sunken"
                  onClick={() => setActiveId(i.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {i.snapshot_name}
                    </span>
                    <span className="block truncate text-xs text-ink-3">
                      {i.snapshot_phone}
                    </span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
