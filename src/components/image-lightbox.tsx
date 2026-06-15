"use client";

import { useCallback, useEffect, useState } from "react";

export type LightboxImage = { url: string; name?: string };

/**
 * Thumbnail strip that opens a full-size overlay on click. Reused by the
 * feedback history page and the admin triage rows. Uses plain <img> (the
 * srcs are short-lived signed Supabase URLs / object URLs, so the Next image
 * optimizer would only get in the way).
 */
export function ImageLightbox({
  images,
  size = "md",
}: {
  images: LightboxImage[];
  size?: "sm" | "md";
}) {
  const [index, setIndex] = useState<number | null>(null);
  const close = useCallback(() => setIndex(null), []);
  const go = useCallback(
    (dir: number) =>
      setIndex((cur) => (cur === null ? cur : (cur + dir + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (index === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, close, go]);

  if (!images || images.length === 0) return null;
  const thumb = size === "sm" ? "h-14 w-14" : "h-20 w-20";
  const current = index !== null ? images[index] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((img, i) => (
          <button
            key={img.url + i}
            type="button"
            onClick={() => setIndex(i)}
            className={`${thumb} overflow-hidden rounded-lg border border-line bg-sunken transition-colors hover:border-line-strong`}
            aria-label={`View ${img.name ?? "screenshot"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.name ?? "Screenshot"} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={(e) => { e.stopPropagation(); go(-1); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={(e) => { e.stopPropagation(); go(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </>
          )}

          <figure className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={current.name ?? "Screenshot"} className="max-h-[88vh] w-auto rounded-lg object-contain" />
            {current.name && <figcaption className="mt-2 text-center text-xs text-white/70">{current.name}</figcaption>}
          </figure>
        </div>
      )}
    </>
  );
}
