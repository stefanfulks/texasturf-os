"use client";

import { useState, useTransition } from "react";
import { X, Trash2, Save, Film, Camera, FileText, Package, Sparkles } from "lucide-react";
import { updateContentDetail, deleteContentItem, aiGenerateContentDetails, type ContentDetailPatch } from "./actions";
import { ASSIGNEES, ASSIGNEE_META } from "@/lib/content/assignees";
import type { ContentWithUrl } from "./page";

const TYPES = [
  ["long_video", "Long video"], ["short", "Short"], ["pov_clip", "POV clip"],
  ["before_after", "Before/After"], ["photo_set", "Photo set"], ["voice_memo", "Voice memo"],
  ["blog_post", "Blog post"], ["other", "Other"],
] as const;

const SERVICE_LINES = [
  "turf", "xeriscape", "lot_clearing", "pavers", "tree_removal", "excavation",
  "stone_work", "site_prep", "concrete", "courts", "fencing", "welding", "landscape_design",
];

/** Full play-by-play editor for one content idea: shots, b-roll, script, props.
 * Slides in from the right; Escape or the backdrop closes it. */
export function ContentDetailPanel({
  item,
  aiEnabled,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: ContentWithUrl;
  aiEnabled: boolean;
  onClose: () => void;
  onSaved: (patch: ContentDetailPatch) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [tag, setTag] = useState(item.tag ?? "");
  const [assignee, setAssignee] = useState(item.assignee ?? "");
  const [type, setType] = useState(item.type);
  const [serviceLine, setServiceLine] = useState(item.service_line ?? "");
  const [hook, setHook] = useState(item.hook ?? "");
  const [script, setScript] = useState(item.script_md ?? "");
  const [shotList, setShotList] = useState(item.shot_list_md ?? "");
  const [bRoll, setBRoll] = useState(item.b_roll_md ?? "");
  const [props, setProps] = useState(item.props_md ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  /** Fill ONLY the empty play-by-play fields — AI never overwrites text the
   * team already wrote, and nothing persists until the user hits Save. */
  async function fillWithAi() {
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await aiGenerateContentDetails(item.id);
      if (res.error || !res.details) {
        setAiNote({ kind: "error", text: res.error ?? "Generation failed." });
        return;
      }
      const d = res.details;
      let filled = 0;
      let kept = 0;
      const apply = (current: string, next: string, set: (v: string) => void) => {
        if (current.trim()) kept++;
        else { set(next); filled++; }
      };
      apply(hook, d.hook, setHook);
      apply(script, d.script_md, setScript);
      apply(shotList, d.shot_list_md, setShotList);
      apply(bRoll, d.b_roll_md, setBRoll);
      apply(props, d.props_md, setProps);
      apply(tag, d.tag, setTag);
      if (!assignee) { setAssignee(d.assignee); filled++; }
      setAiNote(
        filled === 0
          ? { kind: "ok", text: "Every section already has text — clear a section first to regenerate it." }
          : {
              kind: "ok",
              text: kept > 0
                ? `Filled ${filled} empty section${filled === 1 ? "" : "s"}, kept your existing text. Review, then Save.`
                : "Generated — review, then Save.",
            },
      );
    } finally {
      setAiBusy(false);
    }
  }

  function save() {
    setError(null);
    const patch: ContentDetailPatch = {
      title,
      tag: tag || null,
      assignee: (assignee || null) as ContentDetailPatch["assignee"],
      type,
      service_line: serviceLine || null,
      hook: hook || null,
      script_md: script || null,
      shot_list_md: shotList || null,
      b_roll_md: bRoll || null,
      props_md: props || null,
    };
    startTransition(async () => {
      const res = await updateContentDetail(item.id, patch);
      if (res.error) setError(res.error);
      else onSaved(patch);
    });
  }

  function doDelete() {
    startTransition(async () => {
      const res = await deleteContentItem(item.id);
      if (res.error) setError(res.error);
      else onDeleted();
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="eyebrow">Content idea</p>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <label className="field-label">Title</label>
            <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Tag</label>
              <input
                className="field-input"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. 101/FAQ, Ad Creative"
              />
            </div>
            <div>
              <label className="field-label">Who films it</label>
              <select className="field-input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {ASSIGNEES.map((a) => (
                  <option key={a} value={a}>{ASSIGNEE_META[a].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Format</label>
              <select className="field-input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Service line</label>
              <select className="field-input" value={serviceLine} onChange={(e) => setServiceLine(e.target.value)}>
                <option value="">—</option>
                {SERVICE_LINES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Hook / one-line concept</label>
            <input className="field-input" value={hook} onChange={(e) => setHook(e.target.value)} />
          </div>

          <div className="space-y-4 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Play-by-play</p>
              {aiEnabled ? (
                <button
                  type="button"
                  className="btn btn-line btn-sm disabled:opacity-50"
                  onClick={fillWithAi}
                  disabled={aiBusy || pending}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {aiBusy ? "Generating…" : "Fill with AI"}
                </button>
              ) : (
                <span className="chip chip-warn !text-[10px]">AI provider missing</span>
              )}
            </div>
            {aiNote && (
              <p className={`text-xs ${aiNote.kind === "error" ? "text-danger" : "text-brand"}`}>{aiNote.text}</p>
            )}

            <p className="eyebrow flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Script</p>
            <textarea
              className="field-input min-h-24"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Talking points or full script…"
              rows={5}
            />

            <p className="eyebrow flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" /> Shot list</p>
            <textarea
              className="field-input min-h-24"
              value={shotList}
              onChange={(e) => setShotList(e.target.value)}
              placeholder={"1. Wide establishing shot\n2. Close-up on…\n3. …"}
              rows={5}
            />

            <p className="eyebrow flex items-center gap-1.5"><Film className="h-3.5 w-3.5" /> B-roll</p>
            <textarea
              className="field-input min-h-20"
              value={bRoll}
              onChange={(e) => setBRoll(e.target.value)}
              placeholder="Cutaways, timelapses, texture shots…"
              rows={4}
            />

            <p className="eyebrow flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Props / needs</p>
            <textarea
              className="field-input min-h-20"
              value={props}
              onChange={(e) => setProps(e.target.value)}
              placeholder="Wardrobe, location, equipment, permissions…"
              rows={4}
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-4">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-3">Delete this idea?</span>
              <button type="button" className="btn btn-line btn-sm" onClick={() => setConfirmDelete(false)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm bg-danger text-on-brand hover:bg-danger/90" onClick={doDelete} disabled={pending}>
                Confirm delete
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
            <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
