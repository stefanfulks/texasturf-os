"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DeckSlide } from "@/lib/pitch/deck";
import { renderContentSlide, type DisplaySession } from "./deck-slides";

/**
 * Read-only deck player for customer self-explore (kiosk + public link).
 * NO pricing, NO accept actions, NO markPresented. Callers pass slides already
 * filtered of pricing/close. `header` is an optional top slot (kiosk exit).
 */
export function ReadOnlyDeck({ slides, display, header }: { slides: DeckSlide[]; display: DisplaySession; header?: ReactNode }) {
  const [index, setIndex] = useState(0);
  const startX = useRef(0);
  const last = Math.max(0, slides.length - 1);
  const go = (n: number) => setIndex((i) => Math.max(0, Math.min(last, i + n)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  if (slides.length === 0) {
    return <div className="min-h-screen flex items-center justify-center text-ink-3">Nothing to show yet.</div>;
  }
  const slide = slides[index];

  return (
    <div className="min-h-screen flex flex-col">
      {header}
      <div className="flex items-center justify-center gap-1.5 pt-5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={"h-1.5 rounded-full transition-all " + (i === index ? "w-6 bg-brand" : "w-1.5 bg-line-strong")}
          />
        ))}
      </div>

      <div
        className="flex-1 overflow-y-auto"
        onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - startX.current;
          if (dx < -50) go(1);
          else if (dx > 50) go(-1);
        }}
      >
        <div className="min-h-full flex items-center">{renderContentSlide(slide, display)}</div>
      </div>

      <div className="flex items-center justify-between px-6 pb-6 pt-2">
        <button type="button" onClick={() => go(-1)} disabled={index === 0} className="btn btn-line disabled:opacity-40">Back</button>
        <span className="text-xs text-ink-3 tabular-nums">{index + 1} / {slides.length}</span>
        <button type="button" onClick={() => go(1)} disabled={index === last} className="btn btn-primary disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
