import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getScorecard } from "@/lib/finance/cash-flow-queries";
import { usd } from "@/lib/finance/format";

export default async function FinanceHomePage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: snap }, { data: settings }, scorecard] = await Promise.all([
    supabase.from("fin_cash_snapshot").select("ending_cash, ending_avail_credit, working_capital").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("fin_company_settings").select("annual_revenue_plan").eq("fiscal_year", 2026).single(),
    getScorecard(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Finance</h1>
        <p className="text-ink-3 text-sm">FY2026 plan {usd(Number(settings?.annual_revenue_plan ?? 0))}.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Cash on hand" value={usd(Number(snap?.ending_cash ?? 0))} />
        <Card label="Available credit" value={usd(Number(snap?.ending_avail_credit ?? 0))} />
        <Card label="Working capital" value={usd(Number(snap?.working_capital ?? 0))} />
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

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-ink-3">{label}</p>
      <p className="text-2xl font-bold text-ink mt-1">{value}</p>
    </div>
  );
}
