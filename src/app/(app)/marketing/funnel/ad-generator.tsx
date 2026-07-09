"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle, Copy, Check } from "lucide-react";
import { aiGenerateAdScripts } from "./actions";

const AD_LINES = [
  ["pet_turf", "Pet turf"],
  ["playground_turf", "Playground turf"],
  ["sports_turf", "Sports turf"],
  ["putting_green", "Putting green"],
  ["turf", "Turf (general)"],
  ["xeriscape", "Xeriscape"],
  ["pavers", "Pavers"],
  ["courts", "Courts"],
] as const;

type Variant = { angle: string; headline: string; primary_text: string; cta: string };

function CopyBlock({ text }: { text: string }) {
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

/** Cold-lead ad generator — grounded in the owner's real numbers above.
 * Missing numbers come back as bracket placeholders, never invented. */
export function AdGenerator({ aiEnabled }: { aiEnabled: boolean }) {
  const [line, setLine] = useState<string>("pet_turf");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [missingCount, setMissingCount] = useState(0);

  async function run() {
    setBusy(true);
    setError(null);
    setVariants(null);
    try {
      const res = await aiGenerateAdScripts(line);
      if (res.error || !res.variants) {
        setError(res.error ?? "Generation failed.");
        return;
      }
      setVariants(res.variants);
      setMissingCount(res.missingCount ?? 0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel reveal">
      <div className="panel-head">
        <div className="flex items-center gap-2.5">
          <span className="medallion medallion-info !h-7 !w-7 !rounded-[9px]">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-ink">Write cold-lead ads with AI</span>
        </div>
        {aiEnabled ? (
          <span className="chip chip-outline !text-[10px]">AI ready</span>
        ) : (
          <span className="chip chip-warn !text-[10px]">AI provider missing</span>
        )}
      </div>
      <div className="space-y-4 p-5">
        {!aiEnabled ? (
          <p className="flex items-start gap-2 text-xs text-ink-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warn" />
            Set ANTHROPIC_API_KEY to enable ad generation.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <select className="field-input !h-9 w-56 text-sm" value={line} onChange={(e) => setLine(e.target.value)} disabled={busy}>
                {AD_LINES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button type="button" className="btn btn-primary btn-sm disabled:opacity-50" onClick={run} disabled={busy}>
                <Sparkles className="h-3.5 w-3.5" /> {busy ? "Writing 3 angles…" : "Generate 3 ads"}
              </button>
              {error && !busy && <span className="text-xs text-danger">{error}</span>}
            </div>

            {variants && (
              <>
                {missingCount > 0 && (
                  <p className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-tint/50 px-3 py-2 text-xs text-ink-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warn" />
                    {missingCount} of your numbers are still blank — the [bracketed] spots below need real
                    values before these ads run. Fill them in under &ldquo;Your numbers&rdquo;.
                  </p>
                )}
                <div className="space-y-3">
                  {variants.map((v, i) => (
                    <div key={i} className="rounded-xl border border-line bg-hover/40 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="chip chip-brand !text-[10px]">{v.angle}</span>
                        <CopyBlock text={`${v.headline}\n\n${v.primary_text}\n\n${v.cta}`} />
                      </div>
                      <p className="text-sm font-semibold text-ink">{v.headline}</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{v.primary_text}</p>
                      <p className="text-xs font-medium text-brand-strong">{v.cta}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
