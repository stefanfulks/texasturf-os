"use client";
import { useState } from "react";
import { updateDeck } from "../actions";
import { SLIDE_FIELDS, SLIDE_KIND_LABELS, type StoredSlide, type SlideKind, type FieldType } from "@/lib/pitch/deck";

type EditSlide = { id: string; kind: SlideKind; hidden: boolean } & Record<string, unknown>;

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

function toText(value: unknown, type: FieldType): string {
  if (type === "text" || type === "textarea") return typeof value === "string" ? value : "";
  if (!Array.isArray(value)) return "";
  if (type === "lines") return (value as string[]).join("\n");
  if (type === "labels") return (value as { label: string }[]).map((x) => x.label).join("\n");
  if (type === "pairs") return (value as { head: string; body: string }[]).map((p) => `${p.head} | ${p.body}`).join("\n");
  if (type === "quotes") return (value as { quote: string; name: string; city: string }[]).map((q) => `${q.quote} | ${q.name} | ${q.city}`).join("\n");
  if (type === "gallerypairs") return (value as { label: string; beforeUrl?: string; afterUrl?: string }[]).map((p) => [p.label, p.beforeUrl ?? "", p.afterUrl ?? ""].join(" | ")).join("\n");
  if (type === "media") return (value as { url: string; caption?: string }[]).map((m) => (m.caption ? `${m.url} | ${m.caption}` : m.url)).join("\n");
  if (type === "ratings") return (value as { platform: string; score: string; detail?: string }[]).map((r) => [r.platform, r.score, r.detail ?? ""].join(" | ")).join("\n");
  return "";
}

function fromText(text: string, type: FieldType): unknown {
  if (type === "text" || type === "textarea") return text;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (type === "lines") return lines;
  if (type === "labels") return lines.map((l) => ({ label: l }));
  if (type === "pairs") return lines.map((l) => { const i = l.indexOf("|"); return i === -1 ? { head: l, body: "" } : { head: l.slice(0, i).trim(), body: l.slice(i + 1).trim() }; });
  if (type === "quotes") return lines.map((l) => { const p = l.split("|").map((s) => s.trim()); return { quote: p[0] ?? "", name: p[1] ?? "", city: p[2] ?? "" }; });
  if (type === "gallerypairs") return lines.map((l) => { const p = l.split("|").map((s) => s.trim()); return { label: p[0] ?? "", beforeUrl: p[1] || undefined, afterUrl: p[2] || undefined }; });
  if (type === "media") return lines.map((l) => { const i = l.indexOf("|"); return i === -1 ? { url: l } : { url: l.slice(0, i).trim(), caption: l.slice(i + 1).trim() || undefined }; });
  if (type === "ratings") return lines.map((l) => { const p = l.split("|").map((s) => s.trim()); return { platform: p[0] ?? "", score: p[1] ?? "", detail: p[2] || undefined }; });
  return text;
}

export function DeckEditor({ deckId, name: initialName, initialSlides }: { deckId: string; name: string; initialSlides: StoredSlide[] }) {
  const [name, setName] = useState(initialName);
  const [slides, setSlides] = useState<EditSlide[]>(initialSlides as unknown as EditSlide[]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = slides.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setSlides(next);
  }
  function toggleHidden(i: number) {
    const next = slides.slice();
    next[i] = { ...next[i], hidden: !next[i].hidden };
    setSlides(next);
  }
  function setFieldValue(i: number, key: string, value: unknown) {
    const next = slides.slice();
    next[i] = { ...next[i], [key]: value };
    setSlides(next);
  }
  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await updateDeck(deckId, name, slides as unknown as StoredSlide[]);
    setSaving(false);
    setMsg(res.error ? `Error: ${res.error}` : "Saved");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className={field + " max-w-xs"} />
        <button onClick={save} disabled={saving} className="btn btn-primary disabled:opacity-50">{saving ? "Saving…" : "Save deck"}</button>
      </div>
      {msg && <p className={"text-sm mb-3 " + (msg.startsWith("Error") ? "text-danger" : "text-brand")}>{msg}</p>}

      <ul className="space-y-2">
        {slides.map((s, i) => {
          const open = openId === s.id;
          return (
            <li key={s.id} className={"card p-3 " + (s.hidden ? "opacity-60" : "")}>
              <div className="flex items-center gap-2">
                <span className="chip chip-neutral">{SLIDE_KIND_LABELS[s.kind]}</span>
                <span className="text-sm text-ink-2 flex-1 truncate">{typeof s.title === "string" ? s.title : ""}</span>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="btn btn-line btn-sm disabled:opacity-30" aria-label="Move up">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === slides.length - 1} className="btn btn-line btn-sm disabled:opacity-30" aria-label="Move down">↓</button>
                <button onClick={() => toggleHidden(i)} className="btn btn-line btn-sm">{s.hidden ? "Show" : "Hide"}</button>
                <button onClick={() => setOpenId(open ? null : s.id)} className="btn btn-line btn-sm">{open ? "Close" : "Edit"}</button>
              </div>
              {open && (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  {SLIDE_FIELDS[s.kind].map((f) => (
                    <label key={f.key} className="block text-xs font-medium text-ink-3">{f.label}
                      {f.type === "text" ? (
                        <input value={toText(s[f.key], f.type)} onChange={(e) => setFieldValue(i, f.key, fromText(e.target.value, f.type))} className={field} />
                      ) : (
                        <textarea rows={f.type === "textarea" ? 3 : 5} value={toText(s[f.key], f.type)} onChange={(e) => setFieldValue(i, f.key, fromText(e.target.value, f.type))} className={field} />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
