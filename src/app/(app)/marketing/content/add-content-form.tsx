"use client";

import { useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createContentItem, type ActionState } from "./actions";
import { ASSIGNEES, ASSIGNEE_META } from "@/lib/content/assignees";

const initial: ActionState = { error: null, success: false };
const field =
  "field-input";

const TYPES = [
  ["long_video", "Long video"],
  ["short", "Short"],
  ["pov_clip", "POV clip"],
  ["before_after", "Before/After"],
  ["photo_set", "Photo set"],
  ["voice_memo", "Voice memo"],
  ["blog_post", "Blog post"],
  ["other", "Other"],
] as const;

const SERVICE_LINES = [
  "turf", "xeriscape", "lot_clearing", "pavers", "tree_removal", "excavation",
  "stone_work", "site_prep", "concrete", "courts", "fencing", "welding", "landscape_design",
];

export function AddContentForm() {
  const supabase = useMemo(() => createClient(), []);
  const [state, formAction, isPending] = useActionState(createContentItem, initial);
  const [type, setType] = useState<string>("long_video");
  const [assetPath, setAssetPath] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadErr(null);
    if (f.size > 30 * 1024 * 1024) {
      setUploadErr("Audio file is over 30 MB — keep voice memos small.");
      return;
    }
    setUploading(true);
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `voice-memos/${crypto.randomUUID()}-${safe}`;
      const { data, error } = await supabase.storage
        .from("marketing")
        .upload(path, f, { cacheControl: "3600", upsert: false });
      if (error) {
        setUploadErr(error.message);
        return;
      }
      setAssetPath(data.path);
      setUploadedName(f.name);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-ink-3 mb-1">Title <span className="text-danger">*</span></label>
        <input name="title" required placeholder="What is it?" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Type</label>
        <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={field}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Tag</label>
        <input name="tag" placeholder="e.g. 101/FAQ, Ad Creative" className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Who films it</label>
        <select name="assignee" className={field} defaultValue="">
          <option value="">Unassigned</option>
          {ASSIGNEES.map((a) => <option key={a} value={a}>{ASSIGNEE_META[a].label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Service line</label>
        <select name="service_line" className={field} defaultValue="">
          <option value="">—</option>
          {SERVICE_LINES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Status</label>
        <select name="status" className={field} defaultValue={type === "voice_memo" ? "ready" : "idea"}>
          <option value="idea">Idea</option>
          <option value="scripted">Scripted</option>
          <option value="scheduled_shoot">Scheduled shoot</option>
          <option value="filmed">Filmed</option>
          <option value="editing">Editing</option>
          <option value="ready">Ready</option>
          <option value="published">Published</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1">Hook / note</label>
        <input name="hook" placeholder="optional" className={field} />
      </div>

      {type === "voice_memo" ? (
        <div className="sm:col-span-3">
          <label className="block text-xs font-medium text-ink-3 mb-1">Voice memo file (audio, &lt;30 MB)</label>
          <input type="file" accept="audio/*" onChange={onAudioChange} className="text-sm" />
          <input type="hidden" name="asset_path" value={assetPath} />
          {uploading && <p className="text-xs text-ink-3 mt-1">Uploading…</p>}
          {uploadedName && !uploading && <p className="text-xs text-brand mt-1">Uploaded: {uploadedName}</p>}
          {uploadErr && <p className="text-xs text-danger mt-1">{uploadErr}</p>}
        </div>
      ) : (
        <>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-ink-3 mb-1">Drive URL</label>
            <input name="drive_url" placeholder="https://drive.google.com/…" className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-ink-3 mb-1">YouTube URL</label>
            <input name="youtube_url" placeholder="https://youtube.com/…" className={field} />
          </div>
        </>
      )}

      <div className="sm:col-span-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || uploading || (type === "voice_memo" && !assetPath)}
          className="btn btn-primary disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add"}
        </button>
        {state.error && <span className="text-xs text-danger">{state.error}</span>}
        {state.success && <span className="text-xs text-brand">Added — add another or refresh to see it.</span>}
      </div>
    </form>
  );
}
