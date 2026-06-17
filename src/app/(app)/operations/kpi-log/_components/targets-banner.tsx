import type { KpiTarget } from "@/lib/kpi-log/queries";

export function TargetsBanner({ targets }: { targets: KpiTarget[] }) {
  if (targets.length === 0) return null;
  return (
    <div className="rounded-xl border border-line bg-brand-tint/40 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">KPI Targets</p>
      <p className="mt-1 text-sm text-ink-2">
        {targets.map((t, i) => (
          <span key={t.label}>
            <span className="font-medium">{t.label}:</span> {t.value}
            {i < targets.length - 1 ? <span className="mx-2 text-ink-4">•</span> : null}
          </span>
        ))}
      </p>
    </div>
  );
}
