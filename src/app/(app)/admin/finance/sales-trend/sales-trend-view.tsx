"use client";
import { useTransition } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { usd } from "@/lib/finance/format";
import type { SalesTrendResult } from "@/lib/finance/types";
import { saveMonthlyActual } from "./actions";

const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function SalesTrendView({ businessUnitId, fiscalYear, actuals, result }: {
  businessUnitId: string; fiscalYear: number; actuals: (number | null)[]; result: SalesTrendResult;
}) {
  const [pending, start] = useTransition();
  const chartData = M.map((label, i) => ({ label, Budget: Math.round(result.monthlyBudget[i]), Actual: actuals[i] ?? 0, Reforecast: Math.round(result.reforecastToGoal[i]) }));

  return (
    <div className="space-y-5">
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <XAxis dataKey="label" /><YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => usd(Number(value))} /><Legend />
            <Bar dataKey="Budget" fill="#94a3b8" /><Bar dataKey="Actual" fill="#16a34a" /><Bar dataKey="Reforecast" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-ink-3 text-left">
          <th className="px-2 py-1">Month</th><th className="px-2 py-1 text-right">Budget</th>
          <th className="px-2 py-1 text-right">Actual</th><th className="px-2 py-1 text-right">Variance</th>
          <th className="px-2 py-1 text-right">Reforecast→Goal</th>
        </tr></thead>
        <tbody>
          {M.map((label, i) => (
            <tr key={label} className="border-t border-line">
              <td className="px-2 py-1">{label}</td>
              <td className="px-2 py-1 text-right text-ink-3">{usd(result.monthlyBudget[i])}</td>
              <td className="px-2 py-1 text-right">
                <input type="number" defaultValue={actuals[i] ?? ""} className="w-24 bg-tint rounded px-1.5 py-0.5 text-right"
                  onBlur={(e) => { const v = Number(e.target.value); if (e.target.value !== "" && v !== actuals[i]) start(() => { void saveMonthlyActual(businessUnitId, fiscalYear, i + 1, v); }); }} />
              </td>
              <td className={"px-2 py-1 text-right " + (result.monthlyVariance[i] < 0 ? "text-danger" : "text-ink-2")}>
                {actuals[i] == null ? "—" : usd(result.monthlyVariance[i])}
              </td>
              <td className="px-2 py-1 text-right text-ink-3">{usd(result.reforecastToGoal[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pending && <p className="text-xs text-ink-4">saving…</p>}
    </div>
  );
}
