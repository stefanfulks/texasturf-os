import { Calculator, AlertTriangle } from "lucide-react";

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** Live break-even math from the owner's real numbers. Server-rendered, pure
 * props — shows exactly which inputs are still missing instead of guessing. */
export function BreakEvenPanel({
  avgGrossProfit,
  closeRatePct,
  monthlyBudget,
  targetCpl,
}: {
  avgGrossProfit: number | null;
  closeRatePct: number | null;
  monthlyBudget: number | null;
  targetCpl: number | null;
}) {
  const canBreakEven = avgGrossProfit != null && closeRatePct != null;
  const breakEvenCpl = canBreakEven ? avgGrossProfit * (closeRatePct / 100) : null;

  const effectiveCpl = targetCpl ?? breakEvenCpl;
  const canProject = monthlyBudget != null && effectiveCpl != null && effectiveCpl > 0 && closeRatePct != null && avgGrossProfit != null;
  const leads = canProject ? monthlyBudget / effectiveCpl : null;
  const installs = leads != null && closeRatePct != null ? leads * (closeRatePct / 100) : null;
  const grossProfit = installs != null && avgGrossProfit != null ? installs * avgGrossProfit : null;
  const roi = grossProfit != null && monthlyBudget ? grossProfit / monthlyBudget : null;

  const missing: string[] = [];
  if (avgGrossProfit == null) missing.push("avg gross profit per install");
  if (closeRatePct == null) missing.push("close rate");
  if (monthlyBudget == null) missing.push("monthly ad budget");

  return (
    <section className="panel reveal">
      <div className="panel-head">
        <div className="flex items-center gap-2.5">
          <span className="medallion medallion-brand !h-7 !w-7 !rounded-[9px]">
            <Calculator className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-ink">Break-even math — live</span>
        </div>
      </div>
      <div className="p-5">
        {missing.length > 0 && (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-tint/50 px-3 py-2 text-xs text-ink-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warn" />
            Fill in {missing.join(", ")} above to complete this math — nothing here is estimated for you.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="stat stat-accent-brand">
            <span className="stat-label">Break-even CPL</span>
            <span className="stat-value">{breakEvenCpl != null ? money(breakEvenCpl) : "—"}</span>
            <span className="text-[11px] text-ink-4">profit × close rate</span>
          </div>
          <div className="stat">
            <span className="stat-label">Leads / month</span>
            <span className="stat-value">{leads != null ? Math.round(leads).toLocaleString() : "—"}</span>
            <span className="text-[11px] text-ink-4">budget ÷ {targetCpl != null ? "target CPL" : "break-even CPL"}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Installs / month</span>
            <span className="stat-value">{installs != null ? installs.toFixed(1) : "—"}</span>
            <span className="text-[11px] text-ink-4">leads × close rate</span>
          </div>
          <div className={`stat ${roi != null && roi >= 1 ? "stat-accent-brand" : ""}`}>
            <span className="stat-label">Return on ad spend</span>
            <span className="stat-value">{roi != null ? roi.toFixed(1) + "×" : "—"}</span>
            <span className="text-[11px] text-ink-4">{grossProfit != null ? `${money(grossProfit)} gross profit` : "gross profit ÷ budget"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
