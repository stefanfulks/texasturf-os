"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Search, Trophy } from "lucide-react";
import {
  linkJobberClient,
  searchJobberClientsAction,
} from "@/app/(app)/sales/actions";

type HandoffContact = {
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
};

export function JobberHandoff({
  dealId,
  contact,
}: {
  dealId: string;
  contact: HandoffContact | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [searching, startSearch] = useTransition();
  const [linking, startLink] = useTransition();
  const [copied, setCopied] = useState(false);

  const lines = [
    contact?.name && `Name: ${contact.name}`,
    contact?.phone && `Phone: ${contact.phone}`,
    contact?.email && `Email: ${contact.email}`,
    contact?.city && `City: ${contact.city}`,
  ].filter(Boolean) as string[];

  function copy() {
    if (!lines.length) return;
    void navigator.clipboard?.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function runSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      setResults(await searchJobberClientsAction(value));
    });
  }

  function link(jobberClientId: string) {
    startLink(async () => {
      await linkJobberClient(dealId, jobberClientId);
      router.refresh();
    });
  }

  return (
    <div className="card border-brand-line bg-brand-tint/40 px-4 py-3.5">
      <div className="eyebrow mb-2.5 flex items-center gap-1.5 text-brand-strong">
        <Trophy className="size-3.5" strokeWidth={2.2} />
        Hand off to Jobber
      </div>
      <p className="mb-3 text-[13px] text-ink-2">
        This deal is won but isn&apos;t linked to a Jobber client yet. Create the
        client in Jobber with these details, then link it here.
      </p>

      {lines.length ? (
        <div className="mb-3 rounded-lg border border-line bg-surface px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <dl className="space-y-0.5 text-[13px] text-ink">
              {lines.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </dl>
            <button
              onClick={copy}
              className="btn btn-line btn-sm shrink-0"
              title="Copy details"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[12.5px] text-ink-3">
          No prospect contact on this deal to copy.
        </p>
      )}

      <label className="field-label">Link an existing Jobber client</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" />
        <input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Search Jobber clients by name…"
          className="field-input pl-9"
        />
      </div>

      {searching ? (
        <p className="mt-2 text-[12px] text-ink-3">Searching…</p>
      ) : results.length ? (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="truncate text-[13px] text-ink">{r.name}</span>
              <button
                onClick={() => link(r.id)}
                disabled={linking}
                className="btn btn-primary btn-sm shrink-0"
              >
                Link
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 2 ? (
        <p className="mt-2 text-[12px] text-ink-3">No matches.</p>
      ) : null}
    </div>
  );
}
