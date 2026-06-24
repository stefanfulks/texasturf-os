import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listOrders, getLookups, nameMaps } from "../_lib/queries";
import { STAGE_ORDER, stageLabel, isOpenStage, fmtMoney } from "../_lib/status";
import { StageBarChart, VendorBarChart, MonthBarChart } from "./charts";
import type { PurchaseOrder, PoStatus } from "@/lib/db-helpers.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendor Orders Dashboard · TexasTurf OS" };

const SHIPPING: PoStatus[] = ["order_placed", "waiting_on_vendor", "in_transit"];

function committed(o: PurchaseOrder): number {
  return o.final_order_amount ?? o.quote_amount ?? o.estimated_cost ?? 0;
}
function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const due = new Date(d.slice(0, 10) + "T00:00:00").getTime();
  const now = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((due - now) / 86_400_000);
}

export default async function VendorOrdersDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "office"].includes(profile.role)) redirect("/operations/vendor-orders");

  const [orders, lookups] = await Promise.all([listOrders(supabase), getLookups(supabase)]);
  const { vendor: vendorMap } = nameMaps(lookups);

  // Pipeline: count + committed value per stage (non-cancelled).
  const pipeline = STAGE_ORDER.filter((s) => s !== "cancelled").map((s) => {
    const rows = orders.filter((o) => o.status === s);
    return { stage: stageLabel(s), count: rows.length, value: rows.reduce((a, o) => a + committed(o), 0) };
  }).filter((r) => r.count > 0);

  // Vendor spend (actual final order amounts), top 8.
  const byVendor = new Map<string, number>();
  for (const o of orders) {
    if (o.vendor_id && o.final_order_amount) {
      byVendor.set(o.vendor_id, (byVendor.get(o.vendor_id) ?? 0) + o.final_order_amount);
    }
  }
  const vendorSpend = [...byVendor.entries()]
    .map(([id, spend]) => ({ name: vendorMap.get(id) ?? "Unknown", spend }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);

  // Spend by month (last 6 months) from order_date / invoice_date.
  const byMonth = new Map<string, number>();
  for (const o of orders) {
    const d = o.order_date ?? o.invoice_date;
    if (d && o.final_order_amount) {
      const key = d.slice(0, 7); // YYYY-MM
      byMonth.set(key, (byMonth.get(key) ?? 0) + o.final_order_amount);
    }
  }
  const monthSpend = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([k, spend]) => {
      const [y, m] = k.split("-").map(Number);
      return { month: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" }), spend };
    });

  // KPIs
  const openOrders = orders.filter((o) => isOpenStage(o.status));
  const openCommitments = openOrders.reduce((a, o) => a + committed(o), 0);

  let outstandingTotal = 0, overdueAmt = 0, overdueCount = 0, upcomingAmt = 0, upcomingCount = 0;
  for (const o of orders) {
    const bal = o.remaining_balance ?? 0;
    if (bal <= 0) continue;
    outstandingTotal += bal;
    const dd = daysUntil(o.payment_due_date);
    if (dd != null && dd < 0) { overdueAmt += bal; overdueCount++; }
    else if (dd != null && dd <= 30) { upcomingAmt += bal; upcomingCount++; }
  }

  const inTransit = orders.filter((o) => o.status === "in_transit").length;
  const arrivingWeek = orders.filter((o) => SHIPPING.includes(o.status) && (daysUntil(o.eta) ?? 99) >= 0 && (daysUntil(o.eta) ?? 99) <= 7).length;
  const delayed = orders.filter((o) => SHIPPING.includes(o.status) && (daysUntil(o.eta) ?? 1) < 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/operations/vendor-orders" className="text-sm text-ink-3 hover:underline">← Vendor Orders</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Purchasing Dashboard</h1>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink-3">
          No vendor orders yet — metrics appear once requests come in.
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi label="Open orders" value={String(openOrders.length)} />
            <Kpi label="Open commitments" value={fmtMoney(openCommitments)} />
            <Kpi label="Outstanding balance" value={fmtMoney(outstandingTotal)} />
            <Kpi label="Overdue payments" value={fmtMoney(overdueAmt)} sub={`${overdueCount} item${overdueCount === 1 ? "" : "s"}`} tone={overdueAmt > 0 ? "danger" : undefined} />
            <Kpi label="In transit" value={String(inTransit)} />
            <Kpi label="Arriving this week" value={String(arrivingWeek)} sub={delayed > 0 ? `${delayed} delayed` : undefined} tone={delayed > 0 ? "warn" : undefined} />
          </div>

          {/* Pipeline */}
          <Panel title="Purchasing pipeline" subtitle="Open orders by stage">
            <StageBarChart data={pipeline} />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Vendor spend" subtitle="By final order amount (top 8)">
              <VendorBarChart data={vendorSpend} />
            </Panel>
            <Panel title="Spend by month" subtitle="Last 6 months">
              <MonthBarChart data={monthSpend} />
            </Panel>
          </div>

          {/* Outstanding payments + shipments */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Outstanding payments">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Upcoming (30d)" value={fmtMoney(upcomingAmt)} sub={`${upcomingCount}`} />
                <MiniStat label="Overdue" value={fmtMoney(overdueAmt)} sub={`${overdueCount}`} tone={overdueAmt > 0 ? "danger" : undefined} />
                <MiniStat label="Total open" value={fmtMoney(outstandingTotal)} />
              </div>
            </Panel>
            <Panel title="Shipment tracking">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="In transit" value={String(inTransit)} />
                <MiniStat label="Arriving (7d)" value={String(arrivingWeek)} />
                <MiniStat label="Delayed" value={String(delayed)} tone={delayed > 0 ? "warn" : undefined} />
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "warn" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-[11px] text-ink-4">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-4 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "warn" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink-2";
  return (
    <div className="rounded-lg border border-line bg-hover p-3 text-center">
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-[11px] text-ink-4">{label}{sub ? ` · ${sub}` : ""}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-[11px] text-ink-4">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
