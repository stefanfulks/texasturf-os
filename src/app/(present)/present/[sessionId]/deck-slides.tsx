"use client";
import { useState, type ReactNode } from "react";
import type { DeckSlide } from "@/lib/pitch/deck";

/** Minimal prospect display used by content slides (no pricing/internal data). */
export type DisplaySession = { prospectName: string | null; address: string | null };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function SlideShell({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl w-full px-6 py-10">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h1 className="display text-4xl mb-8">{title}</h1>
      {children}
    </div>
  );
}

function CoverSlide({ slide, display }: { slide: Extract<DeckSlide, { kind: "cover" }>; display: DisplaySession }) {
  return (
    <div className="mx-auto max-w-3xl w-full px-6 py-10 text-center">
      {slide.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slide.logoUrl} alt="Texas Turf" className="mx-auto mb-6 h-20 w-20 rounded-2xl object-contain" />
      ) : (
        <p className="eyebrow mb-6">Texas Turf</p>
      )}
      <h1 className="display text-5xl mb-4">{slide.title}</h1>
      {slide.subtitle && <p className="text-lg text-ink-2 mb-8">{slide.subtitle}</p>}
      <div className="inline-block card px-6 py-4 text-left">
        <p className="text-sm text-ink-3">Prepared for</p>
        <p className="text-lg font-medium">{display.prospectName ?? "Your home"}</p>
        {display.address && <p className="text-sm text-ink-2">{display.address}</p>}
      </div>
    </div>
  );
}

function PointsSlide({ slide }: { slide: Extract<DeckSlide, { kind: "why_turf" | "why_us" }> }) {
  return (
    <SlideShell title={slide.title}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {slide.points.map((p, i) => (
          <div key={i} className="card p-5">
            <p className="text-base font-medium mb-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-brand" />{p.head}
            </p>
            <p className="text-sm text-ink-2">{p.body}</p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function SavingsSlide({ slide }: { slide: Extract<DeckSlide, { kind: "savings" }> }) {
  const [monthly, setMonthly] = useState(150);
  const annual = monthly * 12;
  const fifteen = annual * 15;
  return (
    <SlideShell title={slide.title}>
      <p className="text-ink-2 mb-6 max-w-xl">{slide.note}</p>
      <div className="card p-6 max-w-xl">
        <label className="eyebrow">Current lawn upkeep — water, mowing, treatments</label>
        <div className="flex items-center gap-4 mt-2">
          <input type="range" min={0} max={500} step={10} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} className="flex-1" />
          <span className="display text-2xl tabular-nums w-32 text-right">{usd(monthly)}/mo</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="stat"><p className="eyebrow">Per year</p><p className="display text-3xl tabular-nums">{usd(annual)}</p></div>
          <div className="stat"><p className="eyebrow">Over 15 years</p><p className="display text-3xl tabular-nums text-brand">{usd(fifteen)}</p></div>
        </div>
        <p className="text-sm text-ink-3 mt-4">Turf replaces almost all of that — and it still looks great in year 15.</p>
      </div>
    </SlideShell>
  );
}

function GallerySlide({ slide }: { slide: Extract<DeckSlide, { kind: "gallery" }> }) {
  // One pair → a centered hero; multiple → a responsive grid.
  const single = slide.pairs.length === 1;
  return (
    <SlideShell title={slide.title}>
      <div className={"grid gap-4 " + (single ? "max-w-2xl mx-auto" : "grid-cols-1 md:grid-cols-3")}>
        {slide.pairs.map((pair, i) => (
          <div key={i} className="card p-4">
            <div className="grid grid-cols-2 gap-2">
              {pair.beforeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pair.beforeUrl} alt={`${pair.label} before`} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
              ) : (
                <div className="aspect-[4/3] rounded-lg bg-sunken flex items-center justify-center text-xs text-ink-4">Before</div>
              )}
              {pair.afterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pair.afterUrl} alt={`${pair.label} after`} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
              ) : (
                <div className="aspect-[4/3] rounded-lg bg-brand-tint flex items-center justify-center text-xs text-brand">After</div>
              )}
            </div>
            <p className="text-sm text-ink-2 mt-2 text-center">{pair.label}</p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function MediaSlide({ slide }: { slide: Extract<DeckSlide, { kind: "media" }> }) {
  return (
    <SlideShell title={slide.title}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {slide.images.map((img, i) => (
          <figure key={i} className="card p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.caption ?? `Photo ${i + 1}`} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
            {img.caption && <figcaption className="text-xs text-ink-3 mt-1.5 text-center">{img.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </SlideShell>
  );
}

function VideoSlide({ slide }: { slide: Extract<DeckSlide, { kind: "video" }> }) {
  return (
    <SlideShell title={slide.title}>
      <div className="card p-3 max-w-3xl mx-auto">
        <video src={slide.url} poster={slide.poster || undefined} controls playsInline preload="metadata" className="w-full rounded-lg bg-black aspect-video" />
        {slide.caption && <p className="text-sm text-ink-2 mt-2 text-center">{slide.caption}</p>}
      </div>
    </SlideShell>
  );
}

function ProcessSlide({ slide }: { slide: Extract<DeckSlide, { kind: "process" }> }) {
  return (
    <SlideShell title={slide.title}>
      <ol className="space-y-3">
        {slide.steps.map((s, i) => (
          <li key={i} className="card p-4 flex gap-4 items-start">
            <span className="display text-2xl text-brand w-8 shrink-0">{i + 1}</span>
            <div><p className="font-medium">{s.head}</p><p className="text-sm text-ink-2">{s.body}</p></div>
          </li>
        ))}
      </ol>
    </SlideShell>
  );
}

function ReviewsSlide({ slide }: { slide: Extract<DeckSlide, { kind: "reviews" }> }) {
  return (
    <SlideShell title={slide.title}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slide.quotes.map((q, i) => (
          <div key={i} className="card p-5">
            <p className="text-sm text-ink-2 italic">&ldquo;{q.quote}&rdquo;</p>
            <p className="text-sm font-medium mt-3">{q.name}</p>
            <p className="text-xs text-ink-3">{q.city}</p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function FinancingSlide({ slide }: { slide: Extract<DeckSlide, { kind: "financing" }> }) {
  return (
    <SlideShell title={slide.title}>
      <p className="text-lg text-ink-2 mb-6 max-w-xl">{slide.body}</p>
      <ul className="space-y-2 max-w-xl">
        {slide.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-ink-2"><span className="text-brand mt-0.5">&#10003;</span><span>{b}</span></li>
        ))}
      </ul>
      <span className="chip chip-brand mt-6 inline-flex">Powered by Wisestack</span>
    </SlideShell>
  );
}

function CloseSlide({ slide }: { slide: Extract<DeckSlide, { kind: "close" }> }) {
  return (
    <div className="mx-auto max-w-2xl w-full px-6 py-10 text-center">
      <h1 className="display text-5xl mb-4">{slide.title}</h1>
      {slide.subtitle && <p className="text-lg text-ink-2 mb-8">{slide.subtitle}</p>}
      <span className="btn btn-primary text-base px-6 py-3">{slide.cta}</span>
    </div>
  );
}

/**
 * Render any NON-pricing slide. `pricing` returns null here — the authenticated
 * DeckPlayer renders the interactive PricingSlide itself, and the read-only
 * (kiosk / public) surfaces filter pricing + close out entirely.
 */
export function renderContentSlide(slide: DeckSlide, display: DisplaySession): ReactNode {
  switch (slide.kind) {
    case "cover": return <CoverSlide slide={slide} display={display} />;
    case "why_turf":
    case "why_us": return <PointsSlide slide={slide} />;
    case "savings": return <SavingsSlide slide={slide} />;
    case "gallery": return <GallerySlide slide={slide} />;
    case "media": return <MediaSlide slide={slide} />;
    case "video": return <VideoSlide slide={slide} />;
    case "process": return <ProcessSlide slide={slide} />;
    case "reviews": return <ReviewsSlide slide={slide} />;
    case "financing": return <FinancingSlide slide={slide} />;
    case "close": return <CloseSlide slide={slide} />;
    case "pricing": return null;
  }
}
