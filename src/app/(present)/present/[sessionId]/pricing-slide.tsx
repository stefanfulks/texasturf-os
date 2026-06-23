"use client";
import { useState, useTransition } from "react";
import type { PitchSessionView } from "@/lib/pitch/types";
import { acceptPitch, type AcceptResult } from "./actions";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Shared post-reservation card (Jobber redirect or manual handoff). */
function AcceptedCard({ accepted }: { accepted: AcceptResult }) {
  return (
    <div className="card p-5 mt-6">
      <p className="text-lg font-medium text-brand">Reserved</p>
      <p className="text-ink-2 mt-1">
        Deposit due today: <span className="font-medium">{accepted.deposit != null ? usd(accepted.deposit) : "—"}</span>
        {accepted.total != null && <> (50% of {usd(accepted.total)})</>}.
      </p>
      {accepted.clientHubUri ? (
        <>
          <p className="text-sm text-ink-3 mt-2">Your quote is ready in Jobber — approve and pay there (financing available via Wisestack).</p>
          <div className="flex gap-2 mt-3">
            <a href={accepted.clientHubUri} className="btn btn-primary inline-flex">Approve &amp; pay in Jobber</a>
            <a href="/pitch" className="btn btn-line inline-flex">Back to pitches</a>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-3 mt-2">Next: finalize the quote and collect the deposit in Jobber — Wisestack financing appears there once the total is set.</p>
          <div className="flex gap-2 mt-3">
            <a href="https://secure.getjobber.com" target="_blank" rel="noopener noreferrer" className="btn btn-primary inline-flex">Open Jobber</a>
            <a href="/pitch" className="btn btn-line inline-flex">Back to pitches</a>
          </div>
        </>
      )}
    </div>
  );
}

/** Multi-area quote (Pitch v2): itemized areas + add-ons, single total, one reserve. */
function V2Pricing({ session }: { session: PitchSessionView }) {
  const q = session.quoteV2!;
  const [accepted, setAccepted] = useState<AcceptResult | null>(null);
  const [pending, startTransition] = useTransition();
  const canReserve = q.total != null && !q.reviewRequired;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="eyebrow">{session.prospectName ?? "Your install"}{session.address ? ` · ${session.address}` : ""}</p>
      <h1 className="display text-4xl mb-8">Your project</h1>

      <div className="card p-6 space-y-4">
        <ul className="divide-y divide-line">
          {q.areas.map((a, i) => (
            <li key={i} className="flex items-baseline justify-between gap-4 py-3">
              <div>
                <p className="font-medium">{a.label}</p>
                <p className="text-sm text-ink-3">{a.productLabel}{a.sqft ? ` · ${a.sqft.toLocaleString()} sq ft` : ""}</p>
              </div>
              <p className="display text-xl tabular-nums shrink-0">{a.price == null ? "Custom" : usd(a.price)}</p>
            </li>
          ))}
          {q.addons.map((a, i) => (
            <li key={`ad-${i}`} className="flex items-baseline justify-between gap-4 py-3">
              <p className="text-ink-2">{a.label}</p>
              <p className="text-lg tabular-nums shrink-0">{usd(a.price)}</p>
            </li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <div>
            <p className="text-sm text-ink-3">Total investment</p>
            <p className="text-xs text-ink-3">
              {q.warranty.residential_years}-yr residential / {q.warranty.commercial_years}-yr commercial
              {q.warranty.prorated ? " · pro-rated" : " · non-pro-rated"}
            </p>
          </div>
          <div className="text-right">
            <p className="display text-4xl tabular-nums">{q.total == null ? "Custom quote" : usd(q.total)}</p>
            {q.perSqft != null && <p className="text-xs text-ink-3">{usd(q.perSqft)} / sq ft installed</p>}
          </div>
        </div>
      </div>

      {accepted?.ok ? (
        <AcceptedCard accepted={accepted} />
      ) : (
        <div className="card p-5 mt-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-medium">{canReserve ? `${usd(q.total!)} installed` : "Custom quote — we'll confirm"}</p>
            {accepted && !accepted.ok && <p className="text-sm text-danger mt-1">{accepted.error}</p>}
          </div>
          <button
            type="button"
            disabled={!canReserve || pending}
            onClick={() => startTransition(async () => { setAccepted(await acceptPitch(session.id)); })}
            className="btn btn-primary disabled:opacity-50 shrink-0"
          >
            {pending ? "Reserving…" : "Reserve my install"}
          </button>
        </div>
      )}
    </div>
  );
}

export function PricingSlide({ session }: { session: PitchSessionView }) {
  const [selected, setSelected] = useState<string | null>(session.selectedTier);
  const [openTier, setOpenTier] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Prefer the richer multi-area quote when the rep has built one.
  if (session.quoteV2 && session.quoteV2.areas.length > 0) return <V2Pricing session={session} />;

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
        <AcceptedCard accepted={accepted} />
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
