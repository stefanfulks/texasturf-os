"use client";

import { useState, useTransition } from "react";
import { Sparkles, AlertTriangle, Check } from "lucide-react";
import { aiCreateContentCard } from "./actions";

/** Rough idea in → filming-ready card lands in the Ideas column. Renders the
 * full set of provider states: missing (amber, up front), generating, failed,
 * and success. */
export function AiComposer({ aiEnabled }: { aiEnabled: boolean }) {
  const [idea, setIdea] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState<string | null>(null);

  function generate() {
    setError(null);
    setCreatedTitle(null);
    startTransition(async () => {
      const res = await aiCreateContentCard(idea);
      if (res.error) {
        setError(res.error);
      } else if (res.createdTitle) {
        setCreatedTitle(res.createdTitle);
        setIdea("");
      }
    });
  }

  return (
    <details className="panel group">
      <summary className="flex cursor-pointer select-none list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-hover">
        <span className="medallion medallion-info">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-ink">Draft with AI</span>
          <span className="block text-xs text-ink-3">
            Rough idea in — filming-ready card out, straight into Ideas.
          </span>
        </span>
        {aiEnabled ? (
          <span className="chip chip-outline !text-[10px]">AI ready</span>
        ) : (
          <span className="chip chip-warn !text-[10px]">AI provider missing</span>
        )}
      </summary>
      <div className="space-y-3 border-t border-line p-5">
        {!aiEnabled ? (
          <p className="flex items-start gap-2 text-xs text-ink-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warn" />
            AI generation is off because ANTHROPIC_API_KEY isn&rsquo;t set. Add it to the
            environment and redeploy — nothing else to configure.
          </p>
        ) : (
          <>
            <textarea
              className="field-input min-h-20"
              rows={3}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder={"e.g. show how we edge turf against a pool deck so it never lifts"}
              disabled={pending}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-primary disabled:opacity-50"
                onClick={generate}
                disabled={pending || idea.trim().length < 3}
              >
                <Sparkles className="h-4 w-4" />
                {pending ? "Generating…" : "Generate card"}
              </button>
              {pending && (
                <span className="text-xs text-ink-3">
                  Writing the hook, script, shot list, b-roll, and props…
                </span>
              )}
              {error && !pending && <span className="text-xs text-danger">{error}</span>}
              {createdTitle && !pending && !error && (
                <span className="flex items-center gap-1 text-xs text-brand">
                  <Check className="h-3.5 w-3.5" />
                  Added to Ideas: &ldquo;{createdTitle}&rdquo;
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
