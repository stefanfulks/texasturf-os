import { requireAdmin } from "@/lib/auth/require-role";
import { getCashFlowData, getScorecard } from "@/lib/finance/cash-flow-queries";
import { computeCashFlow } from "@/lib/finance/cash-flow";
import { weekStartsForTimeline } from "@/lib/finance/periods";
import { CashFlowView } from "./cash-flow-view";

function currentMonday(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7;
  now.setUTCDate(now.getUTCDate() - diff);
  return now.toISOString().slice(0, 10);
}

export default async function CashFlowPage() {
  await requireAdmin();
  const [data, scorecard] = await Promise.all([getCashFlowData(), getScorecard()]);
  const weekStarts = weekStartsForTimeline(currentMonday());
  const result = computeCashFlow({ ...data, weekStarts, weeklyActuals: {} });

  const groups = [...new Set(scorecard.map((m) => m.metric_group))];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Cash flow — 13 weeks</h1>
        <p className="text-ink-3 text-sm">4 weeks history + current + 8 forecast. Close the current week to snapshot cash + KPIs.</p>
      </header>
      <CashFlowView result={result} creditLimit={data.creditLimit} currentWeekIndex={4} />

      <section className="space-y-2">
        <h2 className="font-medium text-ink">KPI scorecard</h2>
        {groups.map((g) => (
          <div key={g} className="rounded-xl border border-line bg-surface p-3">
            <p className="text-xs uppercase tracking-wide text-ink-3 mb-1">{g}</p>
            <table className="w-full text-sm">
              <tbody>
                {scorecard.filter((m) => m.metric_group === g).map((m) => {
                  const ok = m.lower_is_better ? m.actual <= m.target : m.actual >= m.target;
                  return (
                    <tr key={m.id} className="border-t border-line">
                      <td className="px-2 py-1" title={m.plain_english ?? ""}>{m.label}</td>
                      <td className="px-2 py-1 text-right text-ink-3">target {m.target}</td>
                      <td className={"px-2 py-1 text-right " + (ok ? "text-success" : "text-danger")}>{m.actual}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}
