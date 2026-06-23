"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DeckSlide } from "@/lib/pitch/deck";
import { ReadOnlyDeck } from "./read-only-deck";
import type { DisplaySession } from "./deck-slides";
import { verifyKioskPin } from "./actions";

/**
 * Kiosk mode: the customer self-explores the (pricing-free) deck on the rep's
 * tablet. Best-effort browser fullscreen; exiting back to the rep tools requires
 * the PIN (true device lockdown is iOS Guided Access / Android pinning).
 */
export function KioskDeck({ sessionId, slides, display }: { sessionId: string; slides: DeckSlide[]; display: DisplaySession }) {
  const router = useRouter();
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
  }, []);

  async function submit() {
    setChecking(true);
    setErr(null);
    const res = await verifyKioskPin(sessionId, pin);
    setChecking(false);
    if (res.ok) {
      if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => {});
      router.push(`/present/${sessionId}`);
    } else {
      setErr("Incorrect PIN");
      setPin("");
    }
  }

  const header = (
    <div className="flex justify-end px-4 pt-3">
      <button type="button" onClick={() => setShowPin(true)} className="btn btn-line btn-sm opacity-50">Exit</button>
    </div>
  );

  return (
    <>
      <ReadOnlyDeck slides={slides} display={display} header={header} />
      {showPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card p-6 w-full max-w-xs space-y-3">
            <p className="font-medium">Enter rep PIN to exit</p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-center text-lg tracking-widest"
            />
            {err && <p className="text-sm text-danger">{err}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowPin(false); setPin(""); setErr(null); }} className="btn btn-line flex-1">Cancel</button>
              <button type="button" disabled={checking || !pin} onClick={() => void submit()} className="btn btn-primary flex-1 disabled:opacity-50">{checking ? "…" : "Unlock"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
