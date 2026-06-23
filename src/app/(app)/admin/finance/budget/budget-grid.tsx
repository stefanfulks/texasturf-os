"use client";
import { useState, useTransition } from "react";
import { usd } from "@/lib/finance/format";
import { saveAccountValue } from "./actions";
import type { BudgetRow } from "@/lib/finance/budget-queries";

const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function BudgetGrid({ rows, periodIds, monthLabels }: { rows: BudgetRow[]; periodIds: string[]; monthLabels: string[] }) {
  const [basis, setBasis] = useState<"budget" | "actual">("budget");
  const [, start] = useTransition();
  const labels = monthLabels.length ? monthLabels : M;
  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        {(["budget", "actual"] as const).map((b) => (
          <button key={b} onClick={() => setBasis(b)} className={"rounded-lg px-3 py-1.5 " + (basis === b ? "bg-brand text-white" : "bg-tint text-ink-2")}>{b === "budget" ? "Budget" : "Actual"}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead><tr className="text-ink-3 text-left">
            <th className="px-2 py-1 sticky left-0 bg-surface">Account</th>
            {labels.map((m) => <th key={m} className="px-2 py-1 text-right">{m}</th>)}
            <th className="px-2 py-1 text-right">Total</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const vals = basis === "budget" ? r.budget : r.actual;
              const total = vals.reduce((a, b) => a + b, 0);
              return (
                <tr key={r.account.id} className="border-t border-line">
                  <td className="px-2 py-1 sticky left-0 bg-surface whitespace-nowrap">{r.account.name}</td>
                  {vals.map((v, i) => (
                    <td key={i} className="px-1 py-1">
                      <input type="number" defaultValue={v || ""} className="w-20 bg-tint rounded px-1 py-0.5 text-right"
                        onBlur={(e) => { const n = Number(e.target.value) || 0; if (n !== v) start(() => { void saveAccountValue(r.account.id, periodIds[i], basis, n); }); }} />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-medium">{usd(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
