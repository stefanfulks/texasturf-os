import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getBudgetMatrix } from "@/lib/finance/budget-queries";
import { autoSeedDraft } from "./actions";
import { rollupPnl } from "@/lib/finance/pnl";
import { monthsFromFiscalStart } from "@/lib/finance/periods";
import { usd, pct, signedUsd } from "@/lib/finance/format";
import { BudgetGrid } from "./budget-grid";
import type { PnlLine } from "@/lib/finance/types";

export default async function BudgetPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("fin_company_settings").select("fiscal_year_start_date, annual_revenue_plan").eq("fiscal_year", 2026).single();
  const { periodIds, rows } = await getBudgetMatrix(2026);

  const lines: PnlLine[] = rows.map((r) => ({
    accountId: r.account.id, name: r.account.name, section: r.account.section,
    costBehavior: r.account.cost_behavior, directType: r.account.direct_type as PnlLine["directType"],
    budget: r.budget.reduce((a, b) => a + b, 0), actual: r.actual.reduce((a, b) => a + b, 0), variance: 0,
  }));
  const roll = rollupPnl(lines);
  const months = monthsFromFiscalStart(settings?.fiscal_year_start_date ?? "2026-01-01").map((m) => m.label.split(" ")[0]);
  const revenueBudget = lines.filter((l) => l.section === "income").reduce((a, l) => a + l.budget, 0);
  const plan = Number(settings?.annual_revenue_plan ?? 0);

  async function seed() { "use server"; await autoSeedDraft(2026); }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Budget P&amp;L</h1>
          <p className="text-ink-3 text-sm">Budget vs actual vs variance, FY2026.</p>
        </div>
        <form action={seed}><button className="rounded-lg bg-tint px-3 py-1.5 text-sm">Auto-seed first draft</button></form>
      </header>

      {Math.abs(revenueBudget - plan) > 1 && (
        <p className="text-warn text-sm">⚠ Budgeted revenue ({usd(revenueBudget)}) doesn&apos;t equal the FY2026 plan ({usd(plan)}).</p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Gross margin" b={pct(roll.budget.grossMarginPct)} a={pct(roll.actual.grossMarginPct)} />
        <Card label="Operating income" b={usd(roll.budget.totalOperatingIncome)} a={usd(roll.actual.totalOperatingIncome)} />
        <Card label="Net income" b={usd(roll.budget.netIncome)} a={usd(roll.actual.netIncome)} v={signedUsd(roll.variance.netIncome)} />
      </div>

      <BudgetGrid rows={rows} periodIds={periodIds} monthLabels={months} />
    </div>
  );
}

function Card({ label, b, a, v }: { label: string; b: string; a: string; v?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-ink-3">{label}</p>
      <p className="text-sm text-ink-2 mt-1">Budget <span className="font-semibold text-ink">{b}</span></p>
      <p className="text-sm text-ink-2">Actual <span className="font-semibold text-ink">{a}</span></p>
      {v && <p className="text-sm text-ink-2">Variance <span className="font-semibold">{v}</span></p>}
    </div>
  );
}
