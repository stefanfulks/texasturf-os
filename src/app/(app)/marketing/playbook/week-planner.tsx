"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, AlertTriangle, Check, ArrowUpRight } from "lucide-react";
import { aiPlanThisWeek } from "./actions";
import { ASSIGNEE_META } from "@/lib/content/assignees";
import type { ContentAssignee } from "@/lib/db-helpers.types";

/** One click → four filming-ready cards (one per pillar) land in the Content
 * board's Ideas column, seasoned by the owner's real inputs. */
export function WeekPlanner({ aiEnabled }: { aiEnabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Array<{ title: string; assignee: string }> | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await aiPlanThisWeek();
      if (res.error || !res.created) {
        setError(res.error ?? "Generation failed.");
        return;
      }
      setCreated(res.created);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hero-band reveal p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1 flex items-center gap-1.5 text-brand-strong">
            <Sparkles className="h-3.5 w-3.5" /> Plan this week with AI
          </p>
          <p className="max-w-xl text-sm text-ink-2">
            One click drafts four filming-ready cards — one per pillar (POV, Ivana, Stefan,
            Troy) — straight into the Content board&rsquo;s Ideas column.
          </p>
        </div>
        {aiEnabled ? (
          <button type="button" className="btn btn-primary disabled:opacity-50" onClick={run} disabled={busy}>
            <Sparkles className="h-4 w-4" /> {busy ? "Planning the week…" : created ? "Plan again" : "Plan this week"}
          </button>
        ) : (
          <span className="chip chip-warn !text-[10px] flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> AI provider missing
          </span>
        )}
      </div>

      {error && !busy && <p className="mt-3 text-xs text-danger">{error}</p>}
      {created && !busy && (
        <div className="mt-4 space-y-1.5">
          {created.map((c, i) => {
            const meta = ASSIGNEE_META[c.assignee as ContentAssignee];
            return (
              <p key={i} className="flex items-center gap-2 text-sm text-ink-2">
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-brand" />
                {meta && <span className={`chip ${meta.chip} !h-auto !py-0.5 !text-[10px]`}>{meta.label}</span>}
                <span className="truncate">{c.title}</span>
              </p>
            );
          })}
          <Link href="/marketing/content" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline">
            Open the Content board <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
