"use client";

import { useState, useTransition } from "react";
import { Copy, Check, FastForward, AlertCircle } from "lucide-react";
import { renderMeetingMarkdown, type RenderItem } from "@/lib/meetings/markdown";
import type { Meeting } from "@/lib/meetings/types";
import { carryMeetingItemsForward } from "./actions";

export function AgendaActions({
  meeting,
  occursOn,
  items,
  openCount,
}: {
  meeting: Meeting;
  occursOn: string;
  items: RenderItem[];
  openCount: number;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [carryPending, startCarry] = useTransition();

  async function copyAsMarkdown() {
    const md = renderMeetingMarkdown(meeting, occursOn, items);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard write can fail in non-HTTPS contexts — open a new window
      // with the text so the user can copy manually.
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap;padding:24px">${escapeHtml(md)}</pre>`);
        w.document.title = `${meeting.name} — ${occursOn}`;
      }
    }
  }

  function carry() {
    const fd = new FormData();
    fd.set("meeting_id", meeting.id);
    fd.set("occurs_on", occursOn);
    startCarry(() => carryMeetingItemsForward(fd));
    setConfirming(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copyAsMarkdown}
        className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:border-zinc-400 active:bg-zinc-50"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied — paste into Google Docs" : "Copy as Markdown"}
      </button>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={openCount === 0}
          className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:border-zinc-400 active:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title={openCount === 0 ? "Nothing open to carry forward" : ""}
        >
          <FastForward className="h-3.5 w-3.5" />
          Roll {openCount} open item{openCount === 1 ? "" : "s"} forward
        </button>
      ) : (
        <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 flex-wrap">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Roll {openCount} open item{openCount === 1 ? "" : "s"} forward?</span>
          <button
            type="button"
            onClick={carry}
            disabled={carryPending}
            className="h-7 px-2.5 rounded-md bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 disabled:opacity-50"
          >
            {carryPending ? "Rolling…" : "Yes, roll forward"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-7 px-2 rounded-md text-xs font-medium text-amber-900 hover:bg-amber-100"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
