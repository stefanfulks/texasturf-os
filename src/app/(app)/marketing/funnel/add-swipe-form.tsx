"use client";

import { useState, useTransition } from "react";
import { BookmarkPlus, Check } from "lucide-react";
import { createAdSwipe } from "./actions";

const PLATFORMS = [
  ["facebook", "Facebook"], ["instagram", "Instagram"], ["youtube", "YouTube"],
  ["tiktok", "TikTok"], ["other", "Other"],
] as const;

/** Quick intake for the Ad Lab: name + link + optional pasted copy. Upload +
 * transcription happen on the card afterwards. */
export function AddSwipeForm() {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [transcript, setTranscript] = useState("");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function add() {
    setNote(null);
    startTransition(async () => {
      const res = await createAdSwipe({
        title,
        source_url: url,
        platform,
        transcript: transcript || undefined,
      });
      if (res.error) setNote({ kind: "error", text: res.error });
      else {
        setNote({ kind: "ok", text: "Saved to the board — click the tile to upload the video and run the pipeline." });
        setTitle("");
        setUrl("");
        setTranscript("");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-ink-3">Ad name <span className="text-danger">*</span></label>
        <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Hurricane Nero auto spa — before/after ad" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-3">Link</label>
        <input className="field-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-3">Platform</label>
        <select className="field-input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATFORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="sm:col-span-4">
        <label className="mb-1 block text-xs font-medium text-ink-3">Ad copy / script — optional if you&rsquo;ll upload the video instead</label>
        <textarea className="field-input min-h-16" rows={2} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste the spoken script or ad text if you have it" />
      </div>
      <div className="sm:col-span-4 flex items-center gap-3">
        <button type="button" className="btn btn-primary disabled:opacity-50" onClick={add} disabled={pending || !title.trim()}>
          <BookmarkPlus className="h-4 w-4" /> {pending ? "Saving…" : "Save to board"}
        </button>
        {note && (
          <span className={`flex items-center gap-1 text-xs ${note.kind === "error" ? "text-danger" : "text-brand"}`}>
            {note.kind === "ok" && <Check className="h-3.5 w-3.5" />}
            {note.text}
          </span>
        )}
      </div>
    </div>
  );
}
