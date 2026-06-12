"use client";

import { useState, useTransition } from "react";
import { Video, Copy, Check, Plus } from "lucide-react";
import { setMeetingMeetUrl } from "./actions";

/**
 * The meeting's Google Meet entry point: join button + copy-link button.
 * When no link exists, admins get an inline paste field (covers ad-hoc
 * meetings and creators without Google connected).
 */
export function MeetLink({
  meetingId,
  meetUrl,
  isAdmin,
}: {
  meetingId: string;
  meetUrl: string | null;
  isAdmin: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function copy() {
    if (!meetUrl) return;
    try {
      await navigator.clipboard.writeText(meetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can fail in non-HTTPS contexts — select-and-copy fallback.
      window.prompt("Copy the Meet link:", meetUrl);
    }
  }

  function save() {
    const url = draft.trim();
    if (!/^https:\/\/\S+$/.test(url)) {
      setError("Paste a full https:// link");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("meeting_id", meetingId);
    fd.set("meet_url", url);
    startTransition(async () => {
      await setMeetingMeetUrl(fd);
      setAdding(false);
      setDraft("");
    });
  }

  if (meetUrl) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={meetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand active:bg-brand"
        >
          <Video className="h-3.5 w-3.5" />
          Join Google Meet
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-line bg-white text-xs font-semibold text-ink-2 hover:border-line-strong active:bg-hover"
          title="Copy Meet link"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-dashed border-line-strong bg-white text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Meet link
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://meet.google.com/…"
            autoFocus
            className="h-10 w-64 text-sm border border-line-strong rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-ink bg-white"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="h-10 px-3.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-strong disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setError(null); }}
            className="h-10 px-2 rounded-lg text-xs font-medium text-ink-3 hover:text-ink"
          >
            Cancel
          </button>
          {error && <p className="text-xs text-danger w-full">{error}</p>}
        </div>
      )}
    </div>
  );
}
