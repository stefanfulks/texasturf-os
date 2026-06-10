"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Uploaded = {
  id: string;            // content_items id
  title: string;
  type: string;
  service_line: string | null;
  url: string | null;    // signed preview url
  isImage: boolean;
};

const MAX = 30 * 1024 * 1024; // 30 MB — small audio + photos only (video stays in Drive/YouTube)

function titleFromFile(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() || name;
}

export function QuickCapture({ serviceLines }: { serviceLines: string[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<Uploaded[]>([]);

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    try {
      for (const f of list) {
        const isAudio = f.type.startsWith("audio/");
        const isImage = f.type.startsWith("image/");
        if (!isAudio && !isImage) {
          setError(`"${f.name}" isn't audio or a photo. Video lives in Drive/YouTube — paste its link below instead.`);
          continue;
        }
        if (f.size > MAX) {
          setError(`"${f.name}" is over 30 MB — too big for quick capture.`);
          continue;
        }
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const folder = isAudio ? "voice-memos" : "photos";
        const path = `${folder}/${crypto.randomUUID()}-${safe}`;
        const { data: up, error: upErr } = await supabase.storage
          .from("marketing")
          .upload(path, f, { cacheControl: "3600", upsert: false });
        if (upErr || !up) {
          setError(upErr?.message ?? "Upload failed");
          continue;
        }

        const type = isAudio ? "voice_memo" : "before_after";
        const title = titleFromFile(f.name);
        // createContentItem expects a FormData payload.
        const fd = new FormData();
        fd.set("title", title);
        fd.set("type", type);
        fd.set("status", "ready");
        fd.set("asset_path", up.path);
        const { createContentItem } = await import("./actions");
        const res = await createContentItem({ error: null, success: false }, fd);
        if (!res.success) {
          setError(res.error ?? "Could not save item");
          continue;
        }

        // Look up the row we just created to get its id (most recent matching asset_path).
        const { data: row } = await supabase
          .from("content_items")
          .select("id, title, type, service_line, asset_path")
          .eq("asset_path", up.path)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { data: signed } = await supabase.storage.from("marketing").createSignedUrl(up.path, 3600);
        if (row) {
          setJustAdded((prev) => [
            { id: row.id, title: row.title, type: row.type, service_line: row.service_line, url: signed?.signedUrl ?? null, isImage },
            ...prev,
          ]);
        }
      }
      router.refresh(); // update scoreboard + library counts
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function setServiceLine(id: string, service_line: string) {
    const { updateContentCategory } = await import("./actions");
    const fd = new FormData();
    fd.set("id", id);
    fd.set("service_line", service_line);
    await updateContentCategory({ error: null, success: false }, fd);
    setJustAdded((prev) => prev.map((u) => (u.id === id ? { ...u, service_line } : u)));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragOver ? "border-emerald-400 bg-emerald-50" : "border-zinc-300 bg-white hover:border-zinc-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <p className="text-sm font-semibold text-zinc-800">
          {busy ? "Uploading…" : "Drop voice memos or photos here — or tap to choose"}
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Audio &amp; images up to 30 MB. They upload instantly and the whole team can see them. (Video? Paste a Drive/YouTube link in “Add content”.)
        </p>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {justAdded.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
          <p className="text-xs font-semibold text-zinc-600">Just added — tap a service line to categorize</p>
          {justAdded.map((u) => (
            <div key={u.id} className="flex items-start gap-3 border-t border-zinc-100 pt-3 first:border-0 first:pt-0">
              {u.isImage && u.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.url} alt={u.title} className="h-12 w-12 rounded object-cover border border-zinc-200" />
              ) : (
                <span className="h-12 w-12 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg">♪</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">{u.title}</p>
                {u.url && !u.isImage && <audio controls preload="none" src={u.url} className="h-8 mt-1 w-full max-w-xs" />}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {serviceLines.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setServiceLine(u.id, s)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        u.service_line === s ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
