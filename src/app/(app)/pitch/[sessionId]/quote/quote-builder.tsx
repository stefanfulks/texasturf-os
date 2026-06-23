"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addArea, removeArea } from "../document/actions";
import { saveAndPriceQuote, type AreaInput, type AddonInput, type PriceResult } from "./actions";
import type { PitchArea, PitchAddon } from "@/lib/db-helpers.types";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type AreaRow = {
  id: string; label: string; product: string; sqft: number;
  application: string; tearout: string; access: string; margin: string;
};
type AddonRow = { label: string; kind: string; cost: number; qty: number };

const ADDON_PRESETS = [
  { label: "Drainage upgrade", kind: "drainage" },
  { label: "Pet-grade infill", kind: "pet_infill" },
  { label: "Haul-away / disposal", kind: "haul_away" },
  { label: "Putting green", kind: "putting_green" },
];

export function QuoteBuilder({
  session,
  areas: initialAreas,
  addons: initialAddons,
  productOptions,
}: {
  session: { id: string; prospectName: string | null; address: string | null };
  areas: PitchArea[];
  addons: PitchAddon[];
  productOptions: string[];
}) {
  const sessionId = session.id;
  const fallbackProduct = productOptions[0] ?? "TexasPlay";

  const [areas, setAreas] = useState<AreaRow[]>(
    initialAreas.map((a) => ({
      id: a.id, label: a.label, product: a.product, sqft: Number(a.installed_sqft) || 0,
      application: a.application, tearout: a.tearout_tier, access: a.access,
      margin: a.target_margin != null ? String(a.target_margin) : "",
    })),
  );
  const [addons, setAddons] = useState<AddonRow[]>(
    initialAddons.map((a) => ({ label: a.label, kind: a.kind, cost: Number(a.cost) || 0, qty: Number(a.qty) || 1 })),
  );
  const [result, setResult] = useState<PriceResult | null>(null);
  const [pending, start] = useTransition();

  async function onAddArea() {
    const res = await addArea(sessionId, `Area ${areas.length + 1}`);
    if ("id" in res) {
      setAreas((a) => [
        ...a,
        { id: res.id, label: `Area ${a.length + 1}`, product: fallbackProduct, sqft: 0, application: "soil", tearout: "1", access: "normal", margin: "" },
      ]);
    }
  }
  async function onRemoveArea(id: string) {
    setAreas((a) => a.filter((x) => x.id !== id));
    await removeArea(sessionId, id);
  }
  function setArea(id: string, patch: Partial<AreaRow>) {
    setAreas((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function addPreset(p: { label: string; kind: string }) {
    setAddons((a) => [...a, { label: p.label, kind: p.kind, cost: 0, qty: 1 }]);
  }
  function setAddon(i: number, patch: Partial<AddonRow>) {
    setAddons((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function removeAddon(i: number) {
    setAddons((a) => a.filter((_, j) => j !== i));
  }

  function priceIt() {
    start(async () => {
      const areaInputs: AreaInput[] = areas.map((a) => ({
        id: a.id, label: a.label, product: a.product, installed_sqft: a.sqft,
        application: a.application, tearout_tier: a.tearout, access: a.access,
        target_margin: a.margin === "" ? null : Number(a.margin), tier_key: null,
      }));
      const addonInputs: AddonInput[] = addons.map((a) => ({ label: a.label, kind: a.kind, cost: a.cost, qty: a.qty }));
      setResult(await saveAndPriceQuote(sessionId, areaInputs, addonInputs));
    });
  }

  const priv = result?.privateView;
  const client = result?.client;
  const margin = priv && priv.total != null && priv.total > 0 ? Math.round(((priv.total - priv.cogs) / priv.total) * 100) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="display text-2xl">Build the quote</h1>
          <p className="text-sm text-ink-3">
            {session.prospectName ?? "Prospect"}{session.address ? ` · ${session.address}` : ""} — price each area, add upgrades, then present.
          </p>
        </div>
        <Link href={`/pitch/${sessionId}/document`} className="btn btn-line btn-sm shrink-0">← Document</Link>
      </div>

      {/* Areas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="display text-lg">Areas</h2>
          <button type="button" onClick={onAddArea} className="btn btn-line btn-sm">+ Add area</button>
        </div>
        {areas.length === 0 && <p className="text-sm text-ink-3">No areas yet. Add the backyard, side yard, pet area, putting green…</p>}
        {areas.map((a) => (
          <div key={a.id} className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input value={a.label} onChange={(e) => setArea(a.id, { label: e.target.value })} className={field + " font-medium"} placeholder="Area name" />
              <button type="button" onClick={() => onRemoveArea(a.id)} className="btn btn-line btn-sm shrink-0">Remove</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label className="block text-xs font-medium text-ink-3 col-span-2 sm:col-span-1">Product
                <select value={a.product} onChange={(e) => setArea(a.id, { product: e.target.value })} className={field}>
                  {productOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-ink-3">Sq ft
                <input type="number" min="0" value={a.sqft || ""} onChange={(e) => setArea(a.id, { sqft: Number(e.target.value) })} className={field} />
              </label>
              <label className="block text-xs font-medium text-ink-3">Surface
                <select value={a.application} onChange={(e) => setArea(a.id, { application: e.target.value })} className={field}>
                  <option value="soil">Soil / dirt</option>
                  <option value="concrete">Concrete</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-ink-3">Tear-out
                <select value={a.tearout} onChange={(e) => setArea(a.id, { tearout: e.target.value })} className={field}>
                  {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-ink-3">Access
                <select value={a.access} onChange={(e) => setArea(a.id, { access: e.target.value })} className={field}>
                  <option value="normal">Normal</option>
                  <option value="difficult">Difficult</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-ink-3">Margin % <span className="text-ink-3/70">(opt)</span>
                <input type="number" min="0" max="90" value={a.margin} onChange={(e) => setArea(a.id, { margin: e.target.value })} placeholder="default" className={field} />
              </label>
            </div>
          </div>
        ))}
      </section>

      {/* Add-ons */}
      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="display text-lg">Add-ons</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {ADDON_PRESETS.map((p) => (
            <button key={p.kind} type="button" onClick={() => addPreset(p)} className="chip">+ {p.label}</button>
          ))}
          <button type="button" onClick={() => addPreset({ label: "Custom add-on", kind: "custom" })} className="chip">+ Custom</button>
        </div>
        {addons.length === 0 && <p className="text-sm text-ink-3">No add-ons. Tap a chip to add drainage, pet infill, haul-away, or a putting green.</p>}
        {addons.map((a, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
            <label className="block text-xs font-medium text-ink-3 col-span-2 sm:col-span-1">Label
              <input value={a.label} onChange={(e) => setAddon(i, { label: e.target.value })} className={field} />
            </label>
            <label className="block text-xs font-medium text-ink-3">Cost $
              <input type="number" min="0" value={a.cost || ""} onChange={(e) => setAddon(i, { cost: Number(e.target.value) })} className={field + " w-24"} />
            </label>
            <label className="block text-xs font-medium text-ink-3">Qty
              <input type="number" min="1" value={a.qty || ""} onChange={(e) => setAddon(i, { qty: Number(e.target.value) })} className={field + " w-16"} />
            </label>
            <button type="button" onClick={() => removeAddon(i)} className="btn btn-line btn-sm">Remove</button>
          </div>
        ))}
        <p className="text-xs text-ink-3">Cost is your basis — the customer price is marked up at the deal margin automatically.</p>
      </section>

      {/* Price + present */}
      <div className="flex items-center gap-3 border-t border-line pt-4">
        <button type="button" onClick={priceIt} disabled={pending} className="btn btn-primary disabled:opacity-50">
          {pending ? "Pricing…" : "Price it"}
        </button>
        {client && (
          <Link href={`/present/${sessionId}`} className="btn btn-line">Present pricing →</Link>
        )}
      </div>

      {/* Private rep panel */}
      {priv && client && (
        <section className="card p-4 space-y-4 border-2 border-brand/30">
          <div className="flex items-center justify-between">
            <h2 className="display text-lg">Rep view <span className="text-xs font-normal text-ink-3">— not shown to customer</span></h2>
            {client.reviewRequired && <span className="chip bg-amber-100 text-amber-800 border-amber-300">Custom quote required</span>}
          </div>

          {client.reviewRequired && priv.reviewFlags.length > 0 && (
            <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              {priv.reviewFlags.map((f, i) => <li key={i}>⚠ {f}</li>)}
            </ul>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-ink-3 text-left">
                <tr><th className="py-1 pr-3 font-medium">Area</th><th className="py-1 pr-3 font-medium">Sq ft</th><th className="py-1 pr-3 font-medium">COGS</th><th className="py-1 font-medium text-right">Client price</th></tr>
              </thead>
              <tbody>
                {priv.perArea.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-1 pr-3">{r.label}</td>
                    <td className="py-1 pr-3">{r.sqft.toLocaleString()}</td>
                    <td className="py-1 pr-3 text-ink-3">{usd(r.cogs)}</td>
                    <td className="py-1 text-right">{r.price == null ? "—" : usd(r.price)}</td>
                  </tr>
                ))}
                {client.addons.map((ad, i) => (
                  <tr key={`ad-${i}`} className="border-t border-line">
                    <td className="py-1 pr-3">{ad.label} <span className="text-ink-3">(add-on)</span></td>
                    <td className="py-1 pr-3">—</td>
                    <td className="py-1 pr-3 text-ink-3">—</td>
                    <td className="py-1 text-right">{usd(ad.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-sunken rounded-lg p-3">
              <div className="text-xs text-ink-3">Total COGS</div>
              <div className="display text-lg">{usd(priv.cogs)}</div>
            </div>
            <div className="bg-sunken rounded-lg p-3">
              <div className="text-xs text-ink-3">Margin</div>
              <div className="display text-lg">{margin == null ? "—" : `${margin}%`}</div>
            </div>
            <div className="bg-brand/10 rounded-lg p-3">
              <div className="text-xs text-ink-3">Client total</div>
              <div className="display text-lg text-brand">{client.total == null ? "Custom" : usd(client.total)}</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
