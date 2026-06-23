import { requireAdmin } from "@/lib/auth/require-role";
import { getEmployees, getBurdenRate, getUtilization } from "@/lib/finance/labor-queries";
import { computeLaborBurden } from "@/lib/finance/labor-burden";
import { LaborView } from "./labor-view";

export default async function LaborPage() {
  await requireAdmin();
  const [{ current, goal }, employees] = await Promise.all([getUtilization(), getEmployees()]);
  const rows = await Promise.all(
    employees.map(async (e) => {
      const rates = await getBurdenRate(2026, e.comp.state, e.comp.wcCategory);
      return { id: e.id, name: e.comp.name, roleName: e.roleName, result: computeLaborBurden(e.comp, rates, current, goal) };
    }),
  );
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-ink">Labor burden</h1>
        <p className="text-ink-3 text-sm">Fully-loaded cost per employee. Current utilization {(current * 100).toFixed(0)}%, goal {(goal * 100).toFixed(0)}%.</p>
      </header>
      <LaborView rows={rows} />
    </div>
  );
}
