"use client";
import { useState } from "react";
import { usd, pct } from "@/lib/finance/format";
import { priceJob } from "@/lib/finance/overhead";

export function PricingView({ absorptionRate }: { absorptionRate: number }) {
  const [job, setJob] = useState({ material: 0, burdenedLabor: 0, subcontract: 0, shipping: 0 });
  const [cmp, setCmp] = useState({ cogs: 0, currentPrice: 0, targetMargin: 50 });

  const priced = priceJob({ ...job, absorptionRate });
  const loadedCost = cmp.cogs * (1 + absorptionRate);
  const priceAtMargin = cmp.targetMargin < 100 ? loadedCost / (1 - cmp.targetMargin / 100) : null;
  const marginIfHeld = cmp.currentPrice > 0 ? (cmp.currentPrice - loadedCost) / cmp.currentPrice : null;

  const num = (v: string) => Number(v) || 0;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-xl border border-line bg-surface p-4 space-y-3">
        <h2 className="font-medium text-ink">Job pricing</h2>
        {(["material", "burdenedLabor", "subcontract", "shipping"] as const).map((k) => (
          <label key={k} className="flex items-center justify-between text-sm">
            <span className="text-ink-3">{k === "burdenedLabor" ? "burdened labor" : k}</span>
            <input type="number" className="w-32 bg-tint rounded px-2 py-1 text-right"
              onChange={(e) => setJob((j) => ({ ...j, [k]: num(e.target.value) }))} />
          </label>
        ))}
        <div className="text-sm text-ink-2 border-t border-line pt-2">
          Job cost {usd(priced.actualCost)} → loaded breakeven <span className="font-semibold">{usd(priced.loadedBreakevenCost)}</span>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {priced.priceLadder.map((p) => (
              <tr key={p.marginPct} className="border-t border-line">
                <td className="py-1 text-ink-3">{p.marginPct}% net margin</td>
                <td className="py-1 text-right font-medium">{usd(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4 space-y-3">
        <h2 className="font-medium text-ink">Quote impact (read-only — live quotes unchanged)</h2>
        <label className="flex items-center justify-between text-sm"><span className="text-ink-3">Quote COGS</span>
          <input type="number" className="w-32 bg-tint rounded px-2 py-1 text-right" onChange={(e) => setCmp((c) => ({ ...c, cogs: num(e.target.value) }))} /></label>
        <label className="flex items-center justify-between text-sm"><span className="text-ink-3">Current quoted price</span>
          <input type="number" className="w-32 bg-tint rounded px-2 py-1 text-right" onChange={(e) => setCmp((c) => ({ ...c, currentPrice: num(e.target.value) }))} /></label>
        <label className="flex items-center justify-between text-sm"><span className="text-ink-3">Target margin %</span>
          <input type="number" defaultValue={50} className="w-32 bg-tint rounded px-2 py-1 text-right" onChange={(e) => setCmp((c) => ({ ...c, targetMargin: num(e.target.value) }))} /></label>
        <div className="text-sm space-y-1 border-t border-line pt-2">
          <div>Overhead load ({pct(absorptionRate)}): <span className="font-medium">{usd(cmp.cogs * absorptionRate)}</span></div>
          <div>Loaded cost: <span className="font-medium">{usd(loadedCost)}</span></div>
          <div>Price to hold {cmp.targetMargin}% margin: <span className="font-medium">{priceAtMargin == null ? "—" : usd(priceAtMargin)}</span></div>
          {marginIfHeld != null && (
            <div className={marginIfHeld < 0 ? "text-danger" : "text-ink-2"}>
              Real margin if current price held: <span className="font-semibold">{pct(marginIfHeld)}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
