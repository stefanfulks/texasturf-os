import { requireAdmin } from "@/lib/auth/require-role";
import { getFinanceOverviewInput } from "@/lib/finance/overview-queries";
import { computeFinanceOverview } from "@/lib/finance/metrics";
import { getScorecard } from "@/lib/finance/cash-flow-queries";
import { usd, pct, signedUsd } from "@/lib/finance/format";

export default async function FinanceHomePage() {
  await requireAdmin();
  const [input, scorecard] = await Promise.all([getFinanceOverviewInput(2026), getScorecard()]);
  const o = computeFinanceOverview(input);
  const totalWeeks = input.cashFlow.weeks.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Finance cockpit</h1>
        <p className="text-ink-3 text-sm">
          Live across every module{o.lastQbSyncAt ? ` · QuickBooks synced ${new Date(o.lastQbSyncAt).toLocaleDateString()}` : " · QuickBooks not synced yet"}.
        </p>
      </header>

      {o.alerts.length > 0 && (
        <div className="rounded-xl border border-warn bg-warn/10 p-3 space-y-1">
          {o.alerts.map((a, i) => <p key={i} className="text-sm text-warn">⚠ {a}</p>)}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Cash on hand" value={usd(o.cashOnHand)} href="/admin/finance/cash-flow" />
        <Card label="Working capital" value={usd(o.workingCapital)} sub={`runway ${o.runwayWeeks >= totalWeeks ? totalWeeks + "+" : o.runwayWeeks} wks`} href="/admin/finance/cash-flow" />
        <Card label="Net income vs plan" value={usd(o.pnl.actualNetIncome)} sub={`${signedUsd(o.pnl.varianceNetIncome)} vs budget`} href="/admin/finance/budget" />
        <Card label="Break-even attainment" value={pct(o.breakEvenAttainmentPct)} sub={usd(o.breakEvenRevenue)} href="/admin/finance/break-even" />
        <Card label="Sales pace YTD" value={pct(o.salesPacePct)} sub={`${usd(o.salesActualYtd)} / ${usd(o.salesPlanYtd)}`} href="/admin/finance/sales-trend" />
        <Card label="Gross margin" value={pct(o.grossMarginPct)} sub={`overhead ${pct(o.overheadRate)}`} href="/admin/finance/pricing" />
      </div>

      <section className="space-y-2">
        <h2 className="font-medium text-ink">KPI dictionary</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead><tr className="text-ink-3 text-left">
              <th className="px-2 py-1">Metric</th><th className="px-2 py-1">Group</th><th className="px-2 py-1">Formula</th><th className="px-2 py-1">What it means</th><th className="px-2 py-1">Owner</th>
            </tr></thead>
            <tbody>
              {scorecard.map((m) => (
                <tr key={m.id} className="border-t border-line align-top">
                  <td className="px-2 py-1 font-medium">{m.label}</td>
                  <td className="px-2 py-1 text-ink-3">{m.metric_group}</td>
                  <td className="px-2 py-1 text-ink-3 font-mono text-xs">{m.formula_text}</td>
                  <td className="px-2 py-1 text-ink-2">{m.plain_english}</td>
                  <td className="px-2 py-1 text-ink-3">{m.responsible_role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, sub, href }: { label: string; value: string; sub?: string; href: string }) {
  return (
    <a href={href} className="rounded-xl border border-line bg-surface p-4 hover:bg-hover block">
      <p className="text-xs uppercase tracking-wide text-ink-3">{label}</p>
      <p className="text-lg font-semibold text-ink mt-1">{value}</p>
      {sub && <p className="text-xs text-ink-4 mt-0.5">{sub}</p>}
    </a>
  );
}
