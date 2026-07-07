import { requireAdmin } from "@/lib/auth/require-role";
import { getScorecard } from "@/lib/finance/cash-flow-queries";
import { getFinanceOverviewInput } from "@/lib/finance/overview-queries";
import { CashFlowView } from "./cash-flow-view";

export default async function CashFlowPage() {
  await requireAdmin();
  const [input, scorecard] = await Promise.all([getFinanceOverviewInput(2026), getScorecard()]);
  const result = input.cashFlow;
  const groups = [...new Set(scorecard.map((m) => m.metric_group))];
  const creditLimit = result.weeks[0]?.startingAvailCredit ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Cash flow — 13 weeks</h1>
        <p className="text-ink-3 text-sm">4 weeks history + current + 8 forecast. Forecast weeks include the sales reforecast; close the current week to snapshot.</p>
      </header>
      <CashFlowView result={result} creditLimit={creditLimit} currentWeekIndex={input.currentWeekIndex} />

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
