import { requireAdmin } from "@/lib/auth/require-role";
import { getOverheadInputs } from "@/lib/finance/overhead-queries";
import { computeOverhead } from "@/lib/finance/overhead";
import { pct, usd } from "@/lib/finance/format";
import { PricingView } from "./pricing-view";

export default async function PricingPage() {
  await requireAdmin();
  const inputs = await getOverheadInputs(2026);
  const overhead = computeOverhead(inputs);
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-ink">Overhead absorption &amp; job pricing</h1>
        <p className="text-ink-3 text-sm">
          Absorption rate <span className="font-semibold text-ink">{pct(overhead.absorptionRate)}</span> — {usd(overhead.absorptionRate * 100)} of overhead per $100 of direct cost
          (direct {usd(inputs.totalDirect)}, indirect {usd(inputs.totalIndirect)}).
        </p>
      </header>
      <PricingView absorptionRate={overhead.absorptionRate} />
    </div>
  );
}
