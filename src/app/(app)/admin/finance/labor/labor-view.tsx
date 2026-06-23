"use client";
import { useMemo, useState } from "react";
import { usd } from "@/lib/finance/format";
import { blendedCrewRate } from "@/lib/finance/labor-burden";
import type { LaborBurdenResult } from "@/lib/finance/types";

type Row = { id: string; name: string; roleName: string | null; result: LaborBurdenResult };

export function LaborView({ rows }: { rows: Row[] }) {
  const [util, setUtil] = useState<"lbr100" | "lbrCurrent" | "lbrGoal">("lbrCurrent");
  const [crew, setCrew] = useState<Set<string>>(new Set());

  const blended = useMemo(
    () => blendedCrewRate(rows.filter((r) => crew.has(r.id)).map((r) => r.result), util),
    [rows, crew, util],
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm">
        {(["lbr100", "lbrCurrent", "lbrGoal"] as const).map((k) => (
          <button key={k} onClick={() => setUtil(k)}
            className={"rounded-lg px-3 py-1.5 " + (util === k ? "bg-brand text-white" : "bg-tint text-ink-2")}>
            {k === "lbr100" ? "100%" : k === "lbrCurrent" ? "Current util" : "Goal util"}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-ink-3 text-sm">No employees yet — add them in Settings (or import).</p>
      ) : (
      <table className="w-full text-sm">
        <thead><tr className="text-ink-3 text-left">
          <th className="px-2 py-1"></th><th className="px-2 py-1">Employee</th><th className="px-2 py-1">Role</th>
          <th className="px-2 py-1 text-right">Loaded cost</th><th className="px-2 py-1 text-right">$/hr (100%)</th>
          <th className="px-2 py-1 text-right">$/hr (current)</th><th className="px-2 py-1 text-right">$/hr (goal)</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="px-2 py-1"><input type="checkbox" checked={crew.has(r.id)}
                onChange={(e) => setCrew((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} /></td>
              <td className="px-2 py-1">{r.name}</td>
              <td className="px-2 py-1 text-ink-3">{r.roleName ?? "—"}</td>
              <td className="px-2 py-1 text-right">{usd(r.result.totalAnnualCost)}</td>
              <td className={"px-2 py-1 text-right " + (util === "lbr100" ? "font-semibold text-ink" : "text-ink-3")}>${r.result.lbr100.toFixed(2)}</td>
              <td className={"px-2 py-1 text-right " + (util === "lbrCurrent" ? "font-semibold text-ink" : "text-ink-3")}>${r.result.lbrCurrent.toFixed(2)}</td>
              <td className={"px-2 py-1 text-right " + (util === "lbrGoal" ? "font-semibold text-ink" : "text-ink-3")}>${r.result.lbrGoal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
      {crew.size > 0 && (
        <div className="rounded-xl border border-line bg-tint p-3 text-sm">
          Blended crew rate ({crew.size} selected): <span className="font-semibold">${blended.toFixed(2)}/hr</span>
        </div>
      )}
    </div>
  );
}
