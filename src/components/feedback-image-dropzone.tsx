"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UploadedAttachment = { path: string; name: string; type: string; size: number };

type Item = {
  localId: string;
  name: string;
  type: string;
  size: number;
  previewUrl: string; // object URL for instant preview ("" if invalid)
  path: string; // storage path once uploaded ("" until then)
  uploading: boolean;
  error?: string;
};

const MAX_FILES = 4;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ACCEPT_ATTR = ACCEPT.join(",");

/**
 * Screenshot uploader for the feedback form. Three ways in: drag & drop,
 * click-to-browse, and paste-from-clipboard (Cmd-Shift-4 → paste). Files go
 * straight to the private `feedback` bucket under `{userId}/…`; a hidden
 * `attachments` input carries the uploaded manifest into the server action.
 */
export function FeedbackImageDropzone({
  userId,
  onUploadingChange,
}: {
  userId: string;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [supabase] = useState(() => createClient());
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const [items, setItems] = useState<Item[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const anyUploading = items.some((i) => i.uploading);
  const completed: UploadedAttachment[] = items
    .filter((i) => i.path && !i.error)
    .map(({ path, name, type, size }) => ({ path, name, type, size }));

  // Let the parent form block submit while uploads are in flight.
  useEffect(() => {
    onUploadingChange?.(anyUploading);
  }, [anyUploading, onUploadingChange]);

  const uploadOne = useCallback(
    async (file: File) => {
      const localId = `f${counter.current++}`;

      if (!ACCEPT.includes(file.type)) {
        setItems((p) => [...p, { localId, name: file.name, type: file.type, size: file.size, previewUrl: "", path: "", uploading: false, error: "Images only" }]);
        return;
      }
      if (file.size > MAX_BYTES) {
        setItems((p) => [...p, { localId, name: file.name, type: file.type, size: file.size, previewUrl: "", path: "", uploading: false, error: "Max 10 MB" }]);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setItems((p) => [...p, { localId, name: file.name, type: file.type, size: file.size, previewUrl, path: "", uploading: true }]);

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${Date.now()}-${counter.current}-${safe}`;
      const { data, error } = await supabase.storage.from("feedback").upload(path, file, { cacheControl: "3600", upsert: false });

      setItems((p) =>
        p.map((it) =>
          it.localId === localId
            ? error
              ? { ...it, uploading: false, error: error.message }
              : { ...it, uploading: false, path: data.path }
            : it,
        ),
      );
    },
    [supabase, userId],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const room = MAX_FILES - items.length;
      if (room <= 0) return;
      files.slice(0, room).forEach((f) => void uploadOne(f));
    },
    [items.length, uploadOne],
  );

  // Paste a screenshot from anywhere on the page.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const imgs = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0) return;
      e.preventDefault();
      addFiles(imgs);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles]);

  // Revoke object URLs on unmount. The ref keeps the latest list without
  // re-subscribing the unmount cleanup every render.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    },
    [],
  );

  const removeItem = useCallback(
    async (it: Item) => {
      setItems((p) => p.filter((x) => x.localId !== it.localId));
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      if (it.path) await supabase.storage.from("feedback").remove([it.path]);
    },
    [supabase],
  );

  const full = items.length >= MAX_FILES;

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-3">
        Screenshots <span className="font-normal text-ink-4">(optional)</span>
      </label>

      <div
        onClick={() => !full && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
        className={
          "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors " +
          (full
            ? "cursor-not-allowed border-line bg-sunken opacity-60"
            : "cursor-pointer " + (dragOver ? "border-brand bg-brand-tint" : "border-line-strong bg-hover hover:bg-sunken"))
        }
      >
        <svg className="h-6 w-6 text-ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <p className="text-xs font-medium text-ink-2">
          {full ? `Max ${MAX_FILES} images` : "Drag & drop, click to browse, or paste a screenshot"}
        </p>
        <p className="text-[11px] text-ink-4">PNG, JPG, WebP, GIF · up to 10 MB each</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
      />

      {/* Submitted with the form */}
      <input type="hidden" name="attachments" value={JSON.stringify(completed)} />

      {items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
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
              <button
                type="button"
                onClick={() => void removeItem(it)}
                aria-label="Remove screenshot"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-white text-ink-3 shadow-sm transition-colors hover:text-danger"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
