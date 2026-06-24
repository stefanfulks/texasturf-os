"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const BRAND = "#16a34a";
const BLUE = "#2563eb";
const AMBER = "#d97706";

function usdCompact(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `$${v.toFixed(0)}`;
}

export function StageBarChart({ data }: { data: { stage: string; count: number; value: number }[] }) {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 40, left: 8 }}>
          <XAxis dataKey="stage" angle={-35} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value, name) => (name === "count" ? [value, "Orders"] : [usdCompact(Number(value)), "Committed"])}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={BLUE} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VendorBarChart({ data }: { data: { name: string; spend: number }[] }) {
  if (data.length === 0) return <Empty label="No vendor spend recorded yet." />;
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <XAxis type="number" tickFormatter={usdCompact} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => [usdCompact(Number(value)), "Spend"]} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="spend" radius={[0, 4, 4, 0]} fill={BRAND} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthBarChart({ data }: { data: { month: string; spend: number }[] }) {
  if (data.length === 0) return <Empty label="No spend by month yet." />;
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={usdCompact} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => [usdCompact(Number(value)), "Spend"]} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="spend" radius={[4, 4, 0, 0]} fill={AMBER} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="flex h-[260px] items-center justify-center text-sm text-ink-4">{label}</div>;
}
