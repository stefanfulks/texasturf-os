"use client";
import { useState, useTransition } from "react";
import type { PitchSessionView } from "@/lib/pitch/types";
import { acceptPitch, type AcceptResult } from "./actions";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function PricingSlide({ session }: { session: PitchSessionView }) {
  const [selected, setSelected] = useState<string | null>(session.selectedTier);
  const [openTier, setOpenTier] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="eyebrow">{session.prospectName ?? "Your install"}{session.address ? ` · ${session.address}` : ""}</p>
      <h1 className="display text-4xl mb-8">Choose your turf</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {session.prices.map((p) => {
          const isSel = selected === p.tier;
          const isOpen = openTier === p.tier;
          return (
            <button
              key={p.tier}
              type="button"
              onClick={() => { setSelected(p.tier); setOpenTier(isOpen ? null : p.tier); }}
              className={"text-left card p-5 transition-all min-h-[180px] " + (isSel ? "ring-2 ring-brand border-brand" : "card-hover")}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-2">{p.name}</span>
                {p.tier === "gold" && <span className="chip chip-brand">Most popular</span>}
              </div>
              <p className="text-base font-medium mt-1">{p.productLabel}</p>
              {p.reviewRequired || p.total == null ? (
                <p className="display text-2xl mt-3 text-ink-2">Custom quote</p>
              ) : (
                <>
                  <p className="display text-3xl mt-3 tabular-nums">{usd(p.total)}</p>
                  {p.perSqft != null && <p className="text-xs text-ink-3">{usd(p.perSqft)} / sq ft installed</p>}
                </>
              )}
              <p className="text-xs text-ink-3 mt-3">
                {p.warranty.residential_years}-yr residential / {p.warranty.commercial_years}-yr commercial
                {p.warranty.prorated ? " · pro-rated" : " · non-pro-rated"}
              </p>
              {isOpen && (
                <ul className="mt-3 space-y-1 border-t border-line pt-3">
                  {p.inclusions.map((inc, i) => (
                    <li key={i} className="text-sm text-ink-2">• {inc}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-brand mt-3">{isOpen ? "Hide details" : "Tap to see what's included"}</p>
            </button>
          );
        })}
      </div>

      {accepted?.ok ? (
        <div className="card p-5 mt-6">
          <p className="text-lg font-medium text-brand">Reserved</p>
          <p className="text-ink-2 mt-1">
            Deposit due today: <span className="font-medium">{accepted.deposit != null ? usd(accepted.deposit) : "—"}</span>
            {accepted.total != null && <> (50% of {usd(accepted.total)})</>}.
          </p>
          <p className="text-sm text-ink-3 mt-2">Next: finalize the quote and collect the deposit in Jobber — Wisestack financing appears there once the total is set.</p>
          <div className="flex gap-2 mt-3">
            <a href="https://secure.getjobber.com" target="_blank" rel="noopener noreferrer" className="btn btn-primary inline-flex">Open Jobber</a>
            <a href="/pitch" className="btn btn-line inline-flex">Back to pitches</a>
          </div>
        </div>
      ) : selected ? (() => {
        const p = session.prices.find((x) => x.tier === selected);
        if (!p) return null;
        const canReserve = p.total != null;
        return (
          <div className="card p-5 mt-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-ink-3">Selected · {p.name} — {p.productLabel}</p>
              <p className="text-lg font-medium">{p.total != null ? `${usd(p.total)} installed` : "Custom quote — we'll confirm"}</p>
              {accepted && !accepted.ok && <p className="text-sm text-danger mt-1">{accepted.error}</p>}
            </div>
            <button
              type="button"
              disabled={!canReserve || pending}
              onClick={() => startTransition(async () => { setAccepted(await acceptPitch(session.id, selected)); })}
              className="btn btn-primary disabled:opacity-50 shrink-0"
            >
              {pending ? "Reserving…" : "Reserve my install"}
            </button>
          </div>
        );
      })() : null}
    </div>
  );
}
