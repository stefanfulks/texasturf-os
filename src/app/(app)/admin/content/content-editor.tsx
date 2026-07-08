"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw, ExternalLink } from "lucide-react";
import type { ContentBlock } from "@/lib/content/registry";
import { saveContentBlock, resetContentBlock } from "./actions";

type BlockState = { value: string; isOverride: boolean };

export function ContentEditor({
  groups,
  initial,
}: {
  groups: { group: string; blocks: ContentBlock[]; previewHref?: string }[];
  /** key → { current value (override or default), whether an override exists } */
  initial: Record<string, BlockState>;
}) {
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.group} className="panel reveal">
          <div className="panel-head">
            <h2 className="text-sm font-semibold text-ink">{g.group}</h2>
            {g.previewHref ? (
              <a href={g.previewHref} className="link-arrow" target="_blank" rel="noreferrer">
                View page <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
          <div className="divide-y divide-line">
            {g.blocks.map((b) => (
              <BlockRow key={b.key} block={b} state={initial[b.key]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BlockRow({ block, state }: { block: ContentBlock; state: BlockState }) {
  const [value, setValue] = useState(state.value);
  const [saved, setSaved] = useState(false);
  const [isOverride, setIsOverride] = useState(state.isOverride);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const dirty = value !== state.value;

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveContentBlock(block.key, value);
      if (res.ok) { setIsOverride(true); flash(); }
      else setError(res.error ?? "Save failed");
    });
  }

  function reset() {
    setError(null);
    start(async () => {
      const res = await resetContentBlock(block.key);
      if (res.ok) { setValue(block.default); setIsOverride(false); flash(); }
      else setError(res.error ?? "Reset failed");
    });
  }

  return (
    <div className="px-5 py-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <label htmlFor={block.key} className="text-sm font-medium text-ink">{block.label}</label>
        {isOverride ? <span className="chip chip-brand">edited</span> : <span className="chip chip-neutral">default</span>}
        <code className="ml-auto font-mono text-[0.7rem] text-ink-4">{block.key}</code>
      </div>
      {block.multiline ? (
        <textarea
          id={block.key}
          className="field-input min-h-24 font-sans"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={Math.min(12, Math.max(3, value.split("\n").length + 1))}
        />
      ) : (
        <input id={block.key} className="field-input" value={value} onChange={(e) => setValue(e.target.value)} />
      )}
      {block.help ? <p className="mt-1 text-xs text-ink-3">{block.help}</p> : null}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={pending || !dirty}>
          {saved ? <><Check className="h-3.5 w-3.5" /> Saved</> : "Save"}
        </button>
        {isOverride ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={pending}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset to default
          </button>
        ) : null}
      </div>
    </div>
  );
}
