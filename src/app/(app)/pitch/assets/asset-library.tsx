"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AssetItem = { path: string; name: string; url: string; isVideo: boolean };

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB (testimonial video)
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "video/mp4"];
const ACCEPT_ATTR = "image/png,image/jpeg,image/webp,video/mp4";

type Uploading = { localId: string; name: string; error?: string };

/**
 * Admin media library for the pitch deck. Uploads to the PUBLIC `pitch-assets`
 * bucket (admin-only write via RLS) and surfaces each asset's public URL to copy
 * into a deck slide (gallery before/after, photo grid, or video). Public bucket
 * → no signing, so assets load fast and survive an offline-ish on-site tablet.
 */
export function AssetLibrary({ initial }: { initial: AssetItem[] }) {
  const [supabase] = useState(() => createClient());
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const [assets, setAssets] = useState<AssetItem[]>(initial);
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const uploadOne = useCallback(
    async (file: File) => {
      const localId = `f${counter.current++}`;
      if (!ACCEPT.includes(file.type)) {
        setUploads((p) => [...p, { localId, name: file.name, error: "PNG, JPG, WEBP, or MP4 only" }]);
        return;
      }
      if (file.size > MAX_BYTES) {
        setUploads((p) => [...p, { localId, name: file.name, error: "Max 200 MB" }]);
        return;
      }
      setUploads((p) => [...p, { localId, name: file.name }]);

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${Date.now()}-${counter.current}-${safe}`;
      const { data, error } = await supabase.storage.from("pitch-assets").upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error || !data) {
        setUploads((p) => p.map((u) => (u.localId === localId ? { ...u, error: error?.message ?? "Upload failed" } : u)));
        return;
      }
      const url = supabase.storage.from("pitch-assets").getPublicUrl(data.path).data.publicUrl;
      setUploads((p) => p.filter((u) => u.localId !== localId));
      setAssets((a) => [{ path: data.path, name: file.name, url, isVideo: file.type === "video/mp4" }, ...a]);
    },
    [supabase],
  );

  const addFiles = useCallback((files: File[]) => files.forEach((f) => void uploadOne(f)), [uploadOne]);

  const remove = useCallback(
    async (item: AssetItem) => {
      setAssets((a) => a.filter((x) => x.path !== item.path));
      await supabase.storage.from("pitch-assets").remove([item.path]);
    },
    [supabase],
  );

  const copy = useCallback((url: string) => {
    void navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied((c) => (c === url ? null : c)), 1500);
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <div>
        <h1 className="display text-2xl">Pitch media library</h1>
        <p className="text-sm text-ink-3">
          Upload before/after photos, putting-green shots, and the testimonial video. Copy an asset&apos;s URL into a deck slide
          (Before &amp; after, Photos, or Video) in the <span className="font-medium">deck editor</span>.
        </p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
        className={
          "flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors " +
          (dragOver ? "border-brand bg-brand-tint" : "border-line-strong bg-hover hover:bg-sunken")
        }
      >
        <svg className="h-6 w-6 text-ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        <p className="text-sm font-medium text-ink-2">Drag &amp; drop, or browse</p>
        <p className="text-xs text-ink-4">PNG, JPG, WEBP, or MP4 — up to 200 MB each</p>
      </div>

      <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple className="hidden"
        onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

      {uploads.length > 0 && (
        <ul className="space-y-1">
          {uploads.map((u) => (
            <li key={u.localId} className="text-sm flex items-center gap-2">
              {u.error ? <span className="text-danger">✕ {u.name} — {u.error}</span> : <span className="text-ink-3">Uploading {u.name}…</span>}
            </li>
          ))}
        </ul>
      )}

      {assets.length === 0 ? (
        <p className="text-sm text-ink-3">No assets yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {assets.map((a) => (
            <div key={a.path} className="card p-2 space-y-2">
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-sunken">
                {a.isVideo ? (
                  <video src={a.url} preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
              <p className="text-xs text-ink-2 truncate" title={a.name}>{a.isVideo ? "🎬 " : ""}{a.name}</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => copy(a.url)} className="btn btn-line btn-sm flex-1">
                  {copied === a.url ? "Copied!" : "Copy URL"}
                </button>
                <button type="button" onClick={() => void remove(a)} aria-label="Delete asset" className="btn btn-line btn-sm">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
