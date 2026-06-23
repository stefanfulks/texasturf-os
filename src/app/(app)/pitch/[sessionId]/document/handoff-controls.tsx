"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setKioskPin, enableShareLink, disableShareLink } from "@/app/(present)/present/[sessionId]/actions";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

/**
 * Rep handoff: let the customer self-explore while the rep measures. Two paths —
 * a PIN-locked kiosk on this tablet, or a shareable link to text them. Both hide
 * all pricing. The PIN is set here (hashed server-side) and required to exit kiosk.
 */
export function HandoffControls({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function startKiosk() {
    setBusy(true); setErr(null);
    const res = await setKioskPin(sessionId, pin);
    setBusy(false);
    if (res.ok) router.push(`/present/${sessionId}?kiosk=1`);
    else setErr(res.error ?? "Could not start kiosk");
  }
  async function makeLink() {
    setBusy(true); setErr(null);
    const res = await enableShareLink(sessionId);
    setBusy(false);
    if (res.ok && res.url) setLink(res.url);
    else setErr(res.error ?? "Could not create link");
  }
  async function killLink() {
    setBusy(true);
    await disableShareLink(sessionId);
    setBusy(false); setLink(null);
  }

  return (
    <section className="card p-4 space-y-3">
      <h2 className="display text-lg">Hand to the customer</h2>
      <p className="text-sm text-ink-3">Let them explore while you measure — pricing stays hidden either way.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowPin((s) => !s)} className="btn btn-primary">Kiosk on this tablet</button>
        <button type="button" onClick={() => void makeLink()} disabled={busy} className="btn btn-line disabled:opacity-50">Send a link</button>
      </div>

      {showPin && (
        <div className="flex items-end gap-2">
          <label className="block text-xs font-medium text-ink-3 flex-1">Set an exit PIN (4–8 digits) — you&apos;ll need it to get back
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} className={field} />
          </label>
          <button type="button" onClick={() => void startKiosk()} disabled={busy || !pin} className="btn btn-primary disabled:opacity-50">Start</button>
        </div>
      )}

      {link && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={field + " bg-sunken"} />
            <button type="button" onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn btn-line shrink-0">{copied ? "Copied!" : "Copy"}</button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-3">Works for 14 days · pricing hidden.</p>
            <button type="button" onClick={() => void killLink()} disabled={busy} className="btn btn-line btn-sm">Disable link</button>
          </div>
        </div>
      )}

      {err && <p className="text-sm text-danger">{err}</p>}
    </section>
  );
}
