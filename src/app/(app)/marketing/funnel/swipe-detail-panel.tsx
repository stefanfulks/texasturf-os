"use client";

import { useMemo, useState, useTransition } from "react";
import { X, Trash2, Save, Sparkles, Mic, Layers, Copy, Check, AlertTriangle, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  updateAdSwipe, deleteAdSwipe, transcribeAdSwipe, analyzeAdSwipe, generateSwipeVariants,
} from "./actions";
import type { AiAdStructure, AiCrossBrandVariants } from "@/lib/ai/marketing";
import type { MarketingAdSwipe } from "@/lib/db-helpers.types";

const PLATFORMS = [
  ["facebook", "Facebook"], ["instagram", "Instagram"], ["youtube", "YouTube"],
  ["tiktok", "TikTok"], ["other", "Other"],
] as const;

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm text-ink-4"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** One saved ad: reference link, uploaded copy, transcript, structure
 * breakdown, and cross-brand variants — the full replicate-this-ad pipeline. */
export function SwipeDetailPanel({
  swipe,
  aiEnabled,
  onClose,
  onChanged,
  onDeleted,
}: {
  swipe: MarketingAdSwipe;
  aiEnabled: boolean;
  onClose: () => void;
  onChanged: (patch: Partial<MarketingAdSwipe>) => void;
  onDeleted: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState(swipe.title);
  const [sourceUrl, setSourceUrl] = useState(swipe.source_url ?? "");
  const [platform, setPlatform] = useState(swipe.platform ?? "facebook");
  const [notes, setNotes] = useState(swipe.notes ?? "");
  const [transcript, setTranscript] = useState(swipe.transcript ?? "");
  const [assetPath, setAssetPath] = useState(swipe.asset_path ?? "");
  const structure = swipe.structure as AiAdStructure | null;
  const variants = (swipe.variants ?? {}) as Partial<AiCrossBrandVariants>;

  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"" | "upload" | "transcribe" | "analyze" | "variants">("");
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    setNote(null);
    const patch = {
      title,
      source_url: sourceUrl.trim() || null,
      platform: platform || null,
      notes: notes.trim() || null,
      transcript: transcript.trim() || null,
    };
    startTransition(async () => {
      const res = await updateAdSwipe(swipe.id, patch);
      if (res.error) setNote({ kind: "error", text: res.error });
      else {
        onChanged(patch);
        setNote({ kind: "ok", text: "Saved." });
      }
    });
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setNote(null);
    if (f.size > 25 * 1024 * 1024) {
      setNote({ kind: "error", text: "Keep the file under 25 MB (Whisper's limit) — trim the video or export audio only." });
      return;
    }
    setBusy("upload");
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `ad-swipes/${crypto.randomUUID()}-${safe}`;
      const { data, error } = await supabase.storage
        .from("marketing")
        .upload(path, f, { cacheControl: "3600", upsert: false });
      if (error) {
        setNote({ kind: "error", text: error.message });
        return;
      }
      const res = await updateAdSwipe(swipe.id, { asset_path: data.path });
      if (res.error) {
        setNote({ kind: "error", text: res.error });
        return;
      }
      setAssetPath(data.path);
      onChanged({ asset_path: data.path });
      setNote({ kind: "ok", text: "Uploaded — hit Transcribe." });
    } finally {
      setBusy("");
    }
  }

  async function doTranscribe() {
    setBusy("transcribe");
    setNote(null);
    try {
      const res = await transcribeAdSwipe(swipe.id);
      if (res.error || !res.transcript) {
        setNote({ kind: "error", text: res.error ?? "Transcription failed." });
        return;
      }
      setTranscript(res.transcript);
      onChanged({ transcript: res.transcript, status: swipe.status === "inbox" ? "transcribed" : swipe.status });
      setNote({ kind: "ok", text: "Transcribed — review it, then run the breakdown." });
    } finally {
      setBusy("");
    }
  }

  async function doAnalyze() {
    setBusy("analyze");
    setNote(null);
    try {
      const res = await analyzeAdSwipe(swipe.id);
      if (res.error || !res.structure) {
        setNote({ kind: "error", text: res.error ?? "Analysis failed." });
        return;
      }
      onChanged({ structure: res.structure as unknown as MarketingAdSwipe["structure"], status: "analyzed" });
      setNote({ kind: "ok", text: "Structure broken down." });
    } finally {
      setBusy("");
    }
  }

  async function doVariants() {
    setBusy("variants");
    setNote(null);
    try {
      const res = await generateSwipeVariants(swipe.id);
      if (res.error || !res.variants) {
        setNote({ kind: "error", text: res.error ?? "Generation failed." });
        return;
      }
      onChanged({ variants: res.variants as unknown as MarketingAdSwipe["variants"], status: "drafted" });
      setNote({ kind: "ok", text: "Variants drafted for both brands." });
    } finally {
      setBusy("");
    }
  }

  const anyBusy = busy !== "" || pending;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="eyebrow">Saved ad</p>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <label className="field-label">Title</label>
            <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="field-label">Ad link (Facebook, YouTube, TikTok…)</label>
              <input className="field-input" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label className="field-label">Platform</label>
              <select className="field-input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {PLATFORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Why you saved it</label>
            <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What caught your eye?" />
          </div>

          {/* Step 1: get the words */}
          <div className="space-y-3 border-t border-line pt-4">
            <p className="eyebrow flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" /> 1 · Transcript</p>
            <p className="text-xs text-ink-4">
              Links can&rsquo;t be downloaded from Facebook/YouTube directly — upload a copy of the
              video (a screen recording works, under 25 MB) and Transcribe, or paste the ad&rsquo;s
              script below.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className={`btn btn-line btn-sm ${anyBusy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
                <Upload className="h-3.5 w-3.5" />
                {busy === "upload" ? "Uploading…" : assetPath ? "Replace file" : "Upload video/audio"}
                <input type="file" accept="video/*,audio/*" className="hidden" onChange={onFileChange} disabled={anyBusy} />
              </label>
              <button
                type="button"
                className="btn btn-line btn-sm disabled:opacity-50"
                onClick={doTranscribe}
                disabled={anyBusy || !assetPath}
              >
                <Mic className="h-3.5 w-3.5" /> {busy === "transcribe" ? "Transcribing…" : "Transcribe"}
              </button>
              {assetPath && <span className="text-xs text-ink-4">file attached</span>}
            </div>
            <textarea
              className="field-input min-h-24"
              rows={5}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="…or paste the ad's spoken script / copy here"
            />
          </div>

          {/* Step 2: break it down */}
          <div className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> 2 · Structure breakdown</p>
              {aiEnabled ? (
                <button
                  type="button"
                  className="btn btn-line btn-sm disabled:opacity-50"
                  onClick={doAnalyze}
                  disabled={anyBusy || !transcript.trim()}
                >
                  <Layers className="h-3.5 w-3.5" /> {busy === "analyze" ? "Breaking down…" : structure ? "Re-analyze" : "Break it down"}
                </button>
              ) : (
                <span className="chip chip-warn !text-[10px] flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> AI provider missing
                </span>
              )}
            </div>
            {structure && (
              <div className="space-y-2 rounded-xl border border-line bg-hover/40 p-4 text-sm text-ink-2">
                <p><span className="font-semibold text-ink">Hook:</span> {structure.hook}</p>
                <div>
                  <p className="font-semibold text-ink">Beats:</p>
                  <ol className="ml-4 list-decimal space-y-0.5">
                    {structure.beats.map((b, i) => <li key={i}>{b}</li>)}
                  </ol>
                </div>
                <p><span className="font-semibold text-ink">Offer framing:</span> {structure.offer_framing}</p>
                <p><span className="font-semibold text-ink">CTA:</span> {structure.cta}</p>
                <p><span className="font-semibold text-ink">Why it works:</span> {structure.why_it_works}</p>
                <p><span className="font-semibold text-ink">The steal:</span> {structure.replicable_angle}</p>
              </div>
            )}
          </div>

          {/* Step 3: replicate for both brands */}
          <div className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> 3 · Your versions</p>
              {aiEnabled && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm disabled:opacity-50"
                  onClick={doVariants}
                  disabled={anyBusy || !structure}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {busy === "variants" ? "Writing 4 ads…" : "Generate for both brands"}
                </button>
              )}
            </div>
            {(["texasturf", "turfcasa"] as const).map((brand) => {
              const list = variants[brand];
              if (!list?.length) return null;
              return (
                <div key={brand} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                    {brand === "texasturf" ? "TexasTurf (installs)" : "TurfCasa (turf outlet)"}
                  </p>
                  {list.map((v, i) => (
                    <div key={i} className="rounded-xl border border-line bg-hover/40 p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="chip chip-brand !text-[10px]">{v.angle}</span>
                        <CopyBtn text={`${v.hook_line}\n\n${v.script}\n\n${v.cta}`} />
                      </div>
                      <p className="text-sm font-semibold text-ink">{v.hook_line}</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{v.script}</p>
                      <p className="text-xs font-medium text-brand-strong">{v.cta}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {note && (
            <p className={`text-xs ${note.kind === "error" ? "text-danger" : "text-brand"}`}>{note.text}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-4">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-3">Delete this ad?</span>
              <button type="button" className="btn btn-line btn-sm" onClick={() => setConfirmDelete(false)} disabled={anyBusy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm bg-danger text-on-brand hover:bg-danger/90"
                onClick={() => startTransition(async () => {
                  const res = await deleteAdSwipe(swipe.id);
                  if (res.error) setNote({ kind: "error", text: res.error });
                  else onDeleted();
                })}
                disabled={anyBusy}
              >
                Confirm delete
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={save} disabled={anyBusy}>
            <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
