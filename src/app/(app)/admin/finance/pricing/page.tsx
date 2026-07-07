import { requireAdmin } from "@/lib/auth/require-role";
import { getOverheadInputs } from "@/lib/finance/overhead-queries";
import { computeOverhead } from "@/lib/finance/overhead";
import { getEmployees, getBurdenRate, getUtilization } from "@/lib/finance/labor-queries";
import { computeLaborBurden, blendedCrewRate } from "@/lib/finance/labor-burden";
import { pct, usd } from "@/lib/finance/format";
import { PricingView } from "./pricing-view";

export default async function PricingPage() {
  await requireAdmin();
  const [inputs, util, employees] = await Promise.all([getOverheadInputs(2026), getUtilization(2026), getEmployees()]);
  const overhead = computeOverhead(inputs);
  const burden = await Promise.all(
    employees.map(async (e) => computeLaborBurden(e.comp, await getBurdenRate(2026, e.comp.state, e.comp.wcCategory), util.current, util.goal)),
  );
  const loadedLaborRate = blendedCrewRate(burden, "lbrCurrent");
  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title">Overhead absorption &amp; job pricing</h1>
        <p className="text-ink-3 text-sm">
          Absorption rate <span className="font-semibold text-ink">{pct(overhead.absorptionRate)}</span> · loaded labor <span className="font-semibold text-ink">${loadedLaborRate.toFixed(2)}/hr</span>
          {" "}(direct {usd(inputs.totalDirect)}, indirect {usd(inputs.totalIndirect)}).
        </p>
      </header>
      <PricingView absorptionRate={overhead.absorptionRate} loadedLaborRate={loadedLaborRate} />
    </div>
  );
}
