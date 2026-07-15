"use client";

import { useState, useTransition } from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import {
  createCallList,
  searchContactCandidates,
  searchJobberCandidates,
  listTurfcasaCandidates,
} from "@/lib/dialer/actions";
import type { DialCandidate, DialerBrand, DialTargetType } from "@/lib/dialer/types";
import { TARGET_TYPE_LABELS } from "@/lib/dialer/types";

const STAGES = ["lead", "qualified", "site_visit", "quote_sent", "negotiation"] as const;
const SEGMENTS = ["A", "B", "C", "D", "E", "R"] as const;

type SourceTab = DialTargetType;

function candidateKey(c: DialCandidate): string {
  return `${c.targetType}:${c.targetId}`;
}

export function ListBuilder({ initialBrand }: { initialBrand: DialerBrand }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState<DialerBrand>(initialBrand);
  const [tab, setTab] = useState<SourceTab>(
    initialBrand === "turfcasa" ? "turfcasa_customer" : "sales_contact",
  );

  // Source filters
  const [stage, setStage] = useState("");
  const [segment, setSegment] = useState("");
  const [source, setSource] = useState("");
  const [jobberSearch, setJobberSearch] = useState("");

  const [results, setResults] = useState<DialCandidate[]>([]);
  const [picked, setPicked] = useState<Map<string, DialCandidate>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [creating, startCreate] = useTransition();

  function runSearch() {
    setError(null);
    startSearch(async () => {
      try {
        if (tab === "sales_contact") {
          setResults(
            await searchContactCandidates({
              stage: stage || undefined,
              segment: segment || undefined,
              source: source.trim() || undefined,
            }),
          );
        } else if (tab === "jobber_client") {
          setResults(await searchJobberCandidates(jobberSearch));
        } else {
          setResults(await listTurfcasaCandidates());
        }
      } catch {
        setError("Search failed — try again.");
      }
    });
  }

  function togglePick(c: DialCandidate) {
    setPicked((prev) => {
      const next = new Map(prev);
      const key = candidateKey(c);
      if (next.has(key)) next.delete(key);
      else next.set(key, c);
      return next;
    });
  }

  function pickAll() {
    setPicked((prev) => {
      const next = new Map(prev);
      for (const c of results) next.set(candidateKey(c), c);
      return next;
    });
  }

  function create() {
    setError(null);
    startCreate(async () => {
      const res = await createCallList({
        name,
        description: description || null,
        brand,
        candidates: [...picked.values()],
      });
      // On success the action redirects; reaching here means it failed.
      if (res && !res.ok) setError(res.reason);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        {/* List details */}
        <div className="panel p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-3">List name</span>
              <input
                className="field-input w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="July lead follow-ups"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-3">Brand</span>
              <select
                className="field-input w-full"
                value={brand}
                onChange={(e) => setBrand(e.target.value as DialerBrand)}
              >
                <option value="texasturf">TexasTurf</option>
                <option value="turfcasa">TurfCasa</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-3">
              Description <span className="font-normal">(optional)</span>
            </span>
            <input
              className="field-input w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why this list exists / talk track"
            />
          </label>
        </div>

        {/* Source tabs */}
        <div className="panel">
          <div className="panel-head flex flex-wrap items-center gap-1.5">
            {(["sales_contact", "jobber_client", "turfcasa_customer"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setResults([]);
                }}
                className={`chip ${tab === t ? "bg-ink text-white" : ""}`}
              >
                {TARGET_TYPE_LABELS[t]}s
              </button>
            ))}
          </div>

          <div className="space-y-3 p-4">
            {tab === "sales_contact" && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-3">Deal stage</span>
                  <select className="field-input" value={stage} onChange={(e) => setStage(e.target.value)}>
                    <option value="">Any</option>
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-3">Segment</span>
                  <select className="field-input" value={segment} onChange={(e) => setSegment(e.target.value)}>
                    <option value="">Any</option>
                    {SEGMENTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-3">Source</span>
                  <input
                    className="field-input"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g. website"
                  />
                </label>
                <button type="button" className="btn" onClick={runSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Find contacts
                </button>
              </div>
            )}

            {tab === "jobber_client" && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="block grow max-w-sm">
                  <span className="mb-1 block text-xs font-medium text-ink-3">
                    Search 3,000+ synced clients
                  </span>
                  <input
                    className="field-input w-full"
                    value={jobberSearch}
                    onChange={(e) => setJobberSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                    placeholder="Name or company (min 2 chars)"
                  />
                </label>
                <button type="button" className="btn" onClick={runSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
              </div>
            )}

            {tab === "turfcasa_customer" && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-ink-2">
                  Every TurfCasa order customer with a phone number, deduped
                  across orders.
                </p>
                <button type="button" className="btn" onClick={runSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Load customers
                </button>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-ink-3">
                    {results.length} with a phone number
                  </p>
                  <button type="button" className="btn btn-sm" onClick={pickAll}>
                    <UserPlus className="h-3.5 w-3.5" /> Add all
                  </button>
                </div>
                <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                  {results.map((c) => {
                    const key = candidateKey(c);
                    const isPicked = picked.has(key);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => togglePick(c)}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-sunken ${
                            isPicked ? "bg-brand-tint" : ""
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">
                              {c.name}
                              {c.company ? <span className="font-normal text-ink-3"> · {c.company}</span> : null}
                            </span>
                            <span className="block truncate text-xs text-ink-3">
                              {c.phone}
                              {c.meta ? ` · ${c.meta}` : ""}
                            </span>
                          </span>
                          <span className="chip shrink-0 text-xs">
                            {isPicked ? "Added ✓" : "Add"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {!searching && results.length === 0 && (
              <p className="text-xs text-ink-3">No results yet — run a search above.</p>
            )}
          </div>
        </div>
      </div>

      {/* Picked panel */}
      <div className="panel h-fit lg:sticky lg:top-4">
        <div className="panel-head flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">On this list</p>
          <span className="chip text-xs">{picked.size}</span>
        </div>
        <div className="p-4 space-y-3">
          {picked.size === 0 ? (
            <p className="text-sm text-ink-3">
              Nobody yet — pick people from the sources on the left. You can
              mix contacts, Jobber clients, and TurfCasa customers on one list.
            </p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {[...picked.values()].map((c) => (
                <li
                  key={candidateKey(c)}
                  className="flex items-center justify-between gap-2 rounded-md bg-sunken px-2.5 py-1.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{c.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {TARGET_TYPE_LABELS[c.targetType]} · {c.phone}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-ink-3 hover:text-danger"
                    onClick={() => togglePick(c)}
                    aria-label={`Remove ${c.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={creating || !name.trim() || picked.size === 0}
            onClick={create}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create list &amp; start dialing
          </button>
        </div>
      </div>
    </div>
  );
}
