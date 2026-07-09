"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Link2, X } from "lucide-react";
import { setContentCampaign } from "../actions";

export type LinkedCard = { id: string; title: string; status: string; assignee: string | null };
export type Candidate = { id: string; title: string; status: string };

/** Content cards feeding this campaign: linked list + a picker to link more.
 * Unlink is instant (it only clears the pointer — the card itself is untouched). */
export function LinkContent({
  campaignId,
  linked: initialLinked,
  candidates: initialCandidates,
}: {
  campaignId: string;
  linked: LinkedCard[];
  candidates: Candidate[];
}) {
  const [linked, setLinked] = useState(initialLinked);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [pick, setPick] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function link() {
    const chosen = candidates.find((c) => c.id === pick);
    if (!chosen) return;
    setError(null);
    setLinked((prev) => [...prev, { ...chosen, assignee: null }]);
    setCandidates((prev) => prev.filter((c) => c.id !== chosen.id));
    setPick("");
    startTransition(async () => {
      const res = await setContentCampaign(chosen.id, campaignId);
      if (res.error) setError(res.error);
    });
  }

  function unlink(id: string) {
    const item = linked.find((l) => l.id === id);
    if (!item) return;
    setError(null);
    setLinked((prev) => prev.filter((l) => l.id !== id));
    setCandidates((prev) => [{ id: item.id, title: item.title, status: item.status }, ...prev]);
    startTransition(async () => {
      const res = await setContentCampaign(id, null);
      if (res.error) setError(res.error);
    });
  }

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Content feeding this campaign</h2>
        <Link href="/marketing/content" className="text-xs text-ink-4 hover:underline">
          Content board →
        </Link>
      </div>

      {linked.length === 0 ? (
        <p className="text-sm text-ink-4">No content linked yet — pick a card below or draft one on the Content board.</p>
      ) : (
        <ul className="divide-y divide-line">
          {linked.map((l) => (
            <li key={l.id} className="flex items-center gap-2 py-2">
              <span className="chip chip-outline !h-auto !py-0.5 !text-[10px]">{l.status.replace(/_/g, " ")}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{l.title}</span>
              <button
                type="button"
                onClick={() => unlink(l.id)}
                disabled={pending}
                className="btn btn-ghost btn-sm text-ink-4"
                aria-label={`Unlink ${l.title}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <select className="field-input !h-9 max-w-md flex-1 text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Link an existing content card…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <button type="button" className="btn btn-line btn-sm disabled:opacity-50" onClick={link} disabled={!pick || pending}>
          <Link2 className="h-3.5 w-3.5" /> Link
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </section>
  );
}
