"use client";
import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { computeBreakEven } from "@/lib/finance/break-even";
import { usd, pct } from "@/lib/finance/format";
import type { BreakEvenInput } from "@/lib/finance/types";

export function BreakEvenView({ base }: { base: BreakEvenInput }) {
  const [fixedAdj, setFixedAdj] = useState(0);
  const [marginOverride, setMarginOverride] = useState<number | null>(null);

  const input = useMemo<BreakEvenInput>(() => ({ ...base, totalFixed: base.totalFixed + fixedAdj }), [base, fixedAdj]);
  const r = useMemo(() => computeBreakEven(input), [input]);
  const cm = marginOverride != null ? marginOverride / 100 : r.contributionMarginPct;
  const be = cm > 0 ? input.totalFixed / cm : 0;

  const chart = useMemo(() => {
    const max = Math.max(be, input.netRevenue) * 1.4 || 1;
    const variableRatio = 1 - cm;
    return Array.from({ length: 11 }, (_, i) => {
      const revenue = (max / 10) * i;
      return { revenue: Math.round(revenue), totalCost: Math.round(input.totalFixed + variableRatio * revenue) };
    });
  }, [be, input, cm]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card label="Contribution margin" value={pct(cm)} />
        <Card label="Break-even revenue" value={usd(be)} />
        <Card label="Profit-goal revenue" value={usd(r.profitGoalRevenue)} />
        <Card label="Monthly pace" value={usd(r.monthlyTarget)} />
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 flex flex-wrap gap-4 text-sm">
        <label className="flex flex-col">Fixed-cost adjustment
          <input type="number" className="w-40 bg-tint rounded px-2 py-1" defaultValue={0}
            onChange={(e) => setFixedAdj(Number(e.target.value) || 0)} /></label>
        <label className="flex flex-col">Margin override % (blank = computed)
          <input type="number" className="w-40 bg-tint rounded px-2 py-1"
            onChange={(e) => setMarginOverride(e.target.value === "" ? null : Number(e.target.value))} /></label>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={chart} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <XAxis dataKey="revenue" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => usd(Number(value))} />
              <Line type="monotone" dataKey="revenue" name="Revenue" dot={false} stroke="#16a34a" />
              <Line type="monotone" dataKey="totalCost" name="Total cost" dot={false} stroke="#dc2626" />
              <ReferenceLine x={Math.round(be)} stroke="#6b7280" strokeDasharray="4 4" label="Break-even" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-ink-3">{label}</p>
      <p className="text-xl font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}
