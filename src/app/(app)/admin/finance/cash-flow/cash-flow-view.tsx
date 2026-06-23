"use client";
import { useTransition } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { usd, signedUsd } from "@/lib/finance/format";
import type { CashFlowResult } from "@/lib/finance/types";
import { closeWeek } from "./actions";

export function CashFlowView({ result, creditLimit, currentWeekIndex }: { result: CashFlowResult; creditLimit: number; currentWeekIndex: number }) {
  const [pending, start] = useTransition();
  const chart = result.weeks.map((w) => ({ week: w.weekStart.slice(5), Cash: Math.round(w.endingCash), "Working capital": Math.round(w.workingCapital) }));
  const current = result.weeks[currentWeekIndex];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Ending cash (current wk)" value={usd(current?.endingCash ?? 0)} />
        <Card label="Available credit" value={usd(current?.endingAvailCredit ?? 0)} />
        <Card label="Working capital" value={usd(current?.workingCapital ?? 0)} sub={signedUsd(current?.workingCapitalVariance ?? 0) + " wk/wk"} />
      </div>

      <div className="rounded-xl border border-line bg-surface p-4" style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={chart}>
            <XAxis dataKey="week" /><YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => usd(Number(value))} /><Legend />
            <Line type="monotone" dataKey="Cash" stroke="#2563eb" dot={false} />
            <Line type="monotone" dataKey="Working capital" stroke="#16a34a" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead><tr className="text-ink-3 text-left">
            <th className="px-2 py-1">Week</th><th className="px-2 py-1 text-right">Deposits</th><th className="px-2 py-1 text-right">Expenses</th>
            <th className="px-2 py-1 text-right">Op. profit</th><th className="px-2 py-1 text-right">Ending cash</th>
            <th className="px-2 py-1 text-right">Avail credit</th><th className="px-2 py-1 text-right">Working capital</th><th />
          </tr></thead>
          <tbody>
            {result.weeks.map((w, i) => (
              <tr key={w.weekStart} className={"border-t border-line " + (i === currentWeekIndex ? "bg-tint" : "")}>
                <td className="px-2 py-1 whitespace-nowrap">{w.weekStart}{i === currentWeekIndex ? " ◂ now" : ""}</td>
                <td className="px-2 py-1 text-right">{usd(w.deposits)}</td>
                <td className="px-2 py-1 text-right">{usd(w.expenses)}</td>
                <td className={"px-2 py-1 text-right " + (w.operatingProfit < 0 ? "text-danger" : "")}>{usd(w.operatingProfit)}</td>
                <td className="px-2 py-1 text-right">{usd(w.endingCash)}</td>
                <td className="px-2 py-1 text-right">{usd(w.endingAvailCredit)}</td>
                <td className="px-2 py-1 text-right font-medium">{usd(w.workingCapital)}</td>
                <td className="px-2 py-1">
                  {i === currentWeekIndex && (
                    <button className="text-brand text-xs" disabled={pending}
                      onClick={() => start(() => { void closeWeek(w.weekStart, w.endingCash, w.endingAvailCredit, creditLimit); })}>
                      Close week
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-ink-3">{label}</p>
      <p className="text-xl font-semibold text-ink mt-1">{value}</p>
      {sub && <p className="text-xs text-ink-4 mt-0.5">{sub}</p>}
    </div>
  );
}
