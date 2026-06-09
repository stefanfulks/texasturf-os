import Link from "next/link";
import {
  listToolPurchasesForListPage,
  sumToolPurchasesInRange,
  findActiveBudget,
} from "@/lib/warehouse/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tools & Equipment Spend · TexasTurf OS" };

const CATEGORY_FILTERS = [
  { key: "all",             label: "All" },
  { key: "tool",            label: "Tools" },
  { key: "small_equipment", label: "Small equipment" },
  { key: "supply",          label: "Supplies" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  tool:            "Tool",
  small_equipment: "Small equipment",
  supply:          "Supply",
};

function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

function monthBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start, end };
}

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const activeFilter = CATEGORY_FILTERS.some((f) => f.key === cat) ? cat! : "all";

  const today = new Date();
  const { start, end } = monthBounds(today);
  const todayIso = today.toISOString().slice(0, 10);
  const fromIso  = start.toISOString().slice(0, 10);
  const toIso    = end.toISOString().slice(0, 10);

  const [purchases, monthSpend, budget] = await Promise.all([
    listToolPurchasesForListPage({
      category: activeFilter === "all" ? undefined : activeFilter,
      limit:    100,
    }),
    sumToolPurchasesInRange({ fromIso, toIso }),
    findActiveBudget({ kind: "tool_purchases", todayIso }),
  ]);

  const monthLabel = today.toLocaleString(undefined, { month: "long", year: "numeric" });
  const budgetPct =
    budget && budget.amount_cents > 0
      ? Math.min(100, Math.round((monthSpend / budget.amount_cents) * 100))
      : null;
  const overBudget = budget != null && monthSpend > budget.amount_cents;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tools &amp; Equipment Spend</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Field-logged purchases of tools, small equipment, and supplies.
            Sits alongside <Link href="/invoices" className="underline">invoices</Link>.
          </p>
        </div>
        <Link
          href="/operations/tools/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Log purchase
        </Link>
      </div>

      {/* ─── Spend rollup ────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{monthLabel} spend</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtUSD(monthSpend)}</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Budget</div>
          {budget ? (
            <>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {fmtUSD(budget.amount_cents)}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {budget.period_start} → {budget.period_end}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-zinc-500">No active budget.</div>
          )}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Vs budget</div>
          {budget ? (
            <>
              <div className={"mt-1 text-2xl font-semibold tabular-nums " + (overBudget ? "text-red-700" : "text-zinc-900")}>
                {budgetPct ?? 0}%
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className={"h-full " + (overBudget ? "bg-red-500" : "bg-zinc-900")}
                  style={{ width: `${Math.min(budgetPct ?? 0, 100)}%` }}
                />
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-zinc-500">—</div>
          )}
        </div>
      </section>

      {/* ─── Category pills ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1">
        {CATEGORY_FILTERS.map((f) => {
          const active = f.key === activeFilter;
          const href = f.key === "all" ? "/operations/tools" : `/operations/tools?cat=${f.key}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                (active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400")
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* ─── Table ──────────────────────────────────────────────── */}
      {purchases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-zinc-700">No purchases logged yet for this filter.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Snap a receipt and log it from the field — the team sees the running total instantly.
          </p>
          <Link
            href="/operations/tools/new"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            + Log purchase
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Cost (each)</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((r) => {
                const total = (r.cost_cents ?? 0) * (r.quantity ?? 1);
                return (
                  <tr key={r.id} className="border-t border-zinc-200 hover:bg-zinc-50">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtDate(r.purchase_date)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-900">{r.item_name}</div>
                      {r.asset?.name && (
                        <div className="text-xs text-zinc-500">for {r.asset.name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{CATEGORY_LABELS[r.category] ?? r.category}</td>
                    <td className="px-3 py-2 text-zinc-600">{r.vendor ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.quantity ?? 1}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtUSD(r.cost_cents ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtUSD(total)}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/operations/tools/${r.id}`}
                        className="text-xs font-medium text-zinc-700 hover:text-zinc-900"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
