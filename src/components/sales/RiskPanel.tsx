import { ShieldCheck, TriangleAlert } from "lucide-react";
import type { Deal, DealActivity } from "@/lib/sales/types";
import { assessDeal } from "@/lib/sales/risk";
import { today } from "@/lib/sales/dates";

/**
 * Deterministic deal-health flags. Re-skinned from Evergreen's IntelligencePanel
 * with the violet "Intelligence" treatment and the "Summarize with AI" button
 * removed — pipeline AI lives in the Turfy assistant, not an inline panel.
 */
export function RiskPanel({
  deal,
  activities,
}: {
  deal: Deal;
  activities: DealActivity[];
}) {
  const { flags, health } = assessDeal(deal, activities, today());

  return (
    <div className="card px-4 py-3.5">
      <div className="eyebrow mb-2.5 flex items-center gap-1.5">
        <TriangleAlert className="size-3.5 text-ink-3" strokeWidth={2.2} />
        Risk signals
      </div>

      {flags.length === 0 ? (
        <div className="flex items-center gap-2 text-[13px] text-brand-strong">
          <ShieldCheck className="size-4" strokeWidth={2} />
          Healthy — fresh activity, next step on the calendar.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <span
              key={f.kind}
              className={health === "red" ? "chip chip-danger" : "chip chip-warn"}
            >
              {f.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
