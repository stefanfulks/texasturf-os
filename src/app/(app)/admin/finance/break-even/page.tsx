import { requireAdmin } from "@/lib/auth/require-role";
import { getBreakEvenInputs } from "@/lib/finance/break-even-queries";
import { BreakEvenView } from "./break-even-view";

export default async function BreakEvenPage() {
  await requireAdmin();
  const base = await getBreakEvenInputs(2026);
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-ink">Break-even / profit engineering</h1>
        <p className="text-ink-3 text-sm">Adjust fixed costs or override the margin to see how the break-even point moves.</p>
      </header>
      <BreakEvenView base={base} />
    </div>
  );
}
