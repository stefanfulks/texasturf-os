"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PitchPhotoItem = { id: string; path: string; name: string; url: string };

type Item = {
  localId: string;
  name: string;
  previewUrl: string; // object URL (new) or signed URL (existing); "" on error
  path: string;
  rowId?: string; // pitch_photos row id once persisted
  uploading: boolean;
  error?: string;
};

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB phone photos
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/heic"];
const ACCEPT_ATTR = "image/png,image/jpeg,image/webp,image/heic,image/*";

/**
 * Site-documentation photo uploader. Uploads to the private `pitch-photos`
 * bucket under `{userId}/{sessionId}/…`, then persists each photo IMMEDIATELY
 * via the `onAdded` server action (so a rep's photos survive even if they never
 * hit a final save). `onRemoved` deletes the row + storage object.
 */
export function PitchPhotoDropzone({
  userId,
  sessionId,
  label,
  initial = [],
  onAdded,
  onRemoved,
}: {
  userId: string;
  sessionId: string;
  label: string;
  initial?: PitchPhotoItem[];
  onAdded: (path: string, name: string) => Promise<{ id: string } | { error: string }>;
  onRemoved: (rowId: string, path: string) => Promise<void>;
}) {
  const [supabase] = useState(() => createClient());
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const [items, setItems] = useState<Item[]>(
    initial.map((p, i) => ({ localId: `i${i}`, name: p.name, previewUrl: p.url, path: p.path, rowId: p.id, uploading: false })),
  );
  const [dragOver, setDragOver] = useState(false);

  const uploadOne = useCallback(
    async (file: File) => {
      const localId = `f${counter.current++}`;
      if (!ACCEPT.includes(file.type) && !file.type.startsWith("image/")) {
        setItems((p) => [...p, { localId, name: file.name, previewUrl: "", path: "", uploading: false, error: "Images only" }]);
        return;
      }
      if (file.size > MAX_BYTES) {
        setItems((p) => [...p, { localId, name: file.name, previewUrl: "", path: "", uploading: false, error: "Max 15 MB" }]);
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setItems((p) => [...p, { localId, name: file.name, previewUrl, path: "", uploading: true }]);

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${sessionId}/${Date.now()}-${counter.current}-${safe}`;
      const { data, error } = await supabase.storage.from("pitch-photos").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error || !data) {
        setItems((p) => p.map((it) => (it.localId === localId ? { ...it, uploading: false, error: error?.message ?? "Upload failed" } : it)));
        return;
      }
      const res = await onAdded(data.path, file.name);
      setItems((p) =>
        p.map((it) =>
          it.localId === localId
            ? "error" in res
              ? { ...it, uploading: false, error: res.error }
              : { ...it, uploading: false, path: data.path, rowId: res.id }
            : it,
        ),
      );
    },
    [supabase, userId, sessionId, onAdded],
  );

  const addFiles = useCallback((files: File[]) => files.forEach((f) => void uploadOne(f)), [uploadOne]);

  const removeItem = useCallback(
    async (it: Item) => {
      setItems((p) => p.filter((x) => x.localId !== it.localId));
      if (it.previewUrl.startsWith("blob:")) URL.revokeObjectURL(it.previewUrl);
      if (it.rowId) await onRemoved(it.rowId, it.path);
      else if (it.path) await supabase.storage.from("pitch-photos").remove([it.path]);
    },
    [supabase, onRemoved],
  );

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink-3">{label}</p>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
        className={
          "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center cursor-pointer transition-colors " +
          (dragOver ? "border-brand bg-brand-tint" : "border-line-strong bg-hover hover:bg-sunken")
        }
      >
        <svg className="h-5 w-5 text-ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        <p className="text-xs font-medium text-ink-2">Take a photo, drag &amp; drop, or browse</p>
        <p className="text-[11px] text-ink-4">up to 15 MB each</p>
      </div>

      <input ref={inputRef} type="file" accept={ACCEPT_ATTR} capture="environment" multiple className="hidden"
        onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((it) => (
            <li key={it.localId} className="relative">
              <div className={"h-16 w-16 overflow-hidden rounded-lg border " + (it.error ? "border-danger/40 bg-danger-tint" : "border-line bg-sunken")}>
                {it.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.previewUrl} alt={it.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-1 text-center text-[9px] font-medium leading-tight text-danger">{it.error}</div>
                )}
                {it.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                    <svg className="h-4 w-4 animate-spin text-ink-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => void removeItem(it)} aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-white text-ink-3 shadow-sm hover:text-danger">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
