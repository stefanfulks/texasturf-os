import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listOrders, getLookups, nameMaps } from "./_lib/queries";
import {
  STAGE_ORDER, STAGE_META, PRIORITY_META, PAYMENT_STATUS_META,
  stageLabel, stageBadge, isOpenStage, poNumber, fmtMoney, fmtDate,
} from "./_lib/status";
import type { PoStatus } from "@/lib/db-helpers.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendor Orders · TexasTurf OS" };

export default async function VendorOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const [orders, lookups] = await Promise.all([listOrders(supabase), getLookups(supabase)]);
  const { profile: buyerMap, vendor: vendorMap } = nameMaps(lookups);

  // Stage counts across everything (drives the pipeline strip).
  const counts = new Map<PoStatus, number>();
  for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);

  const activeStatus = STAGE_ORDER.includes(sp.status as PoStatus) ? (sp.status as PoStatus) : null;
  const showAll = sp.view === "all";

  const visible = orders.filter((o) => {
    if (activeStatus) return o.status === activeStatus;
    if (showAll) return true;
    return isOpenStage(o.status); // default: open work only
  });

  const openCount = orders.filter((o) => isOpenStage(o.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Vendor Orders</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            Purchase requests from request → order → delivery → payment. {openCount} open.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/operations/vendor-orders/dashboard" className="btn btn-ghost">Dashboard</Link>
          <Link href="/operations/vendor-orders/new" className="btn btn-primary">+ New request</Link>
        </div>
      </div>

      {/* Pipeline strip */}
      <div className="-mx-1 overflow-x-auto">
        <div className="flex items-stretch gap-2 px-1 pb-1 min-w-max">
          <PipelineChip href="/operations/vendor-orders" label="Open" count={openCount} active={!activeStatus && !showAll} />
          {STAGE_ORDER.filter((s) => isOpenStage(s) || (counts.get(s) ?? 0) > 0).map((s) => (
            <PipelineChip
              key={s}
              href={`/operations/vendor-orders?status=${s}`}
              label={stageLabel(s)}
              count={counts.get(s) ?? 0}
              badge={STAGE_META[s].badge}
              active={activeStatus === s}
            />
          ))}
          <PipelineChip href="/operations/vendor-orders?view=all" label="All" count={orders.length} active={showAll} />
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
          <p className="text-sm font-medium text-ink-2">
            {activeStatus ? `No orders in ${stageLabel(activeStatus)}.` : "No open vendor orders."}
          </p>
          <p className="mt-1 text-xs text-ink-3">Create a request when the warehouse needs material.</p>
          <Link href="/operations/vendor-orders/new" className="btn btn-primary mt-4">+ New request</Link>
        </div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead className="bg-hover text-left text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-3 py-2 font-medium">PO</th>
                <th className="px-3 py-2 font-medium">Request</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Buyer</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Needed by</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((o) => {
                const pr = PRIORITY_META[o.priority];
                const amount = o.final_order_amount ?? o.quote_amount ?? o.estimated_cost ?? null;
                return (
                  <tr key={o.id} className="hover:bg-hover transition-colors">
                    <td className="px-3 py-2.5 align-top">
                      <Link href={`/operations/vendor-orders/${o.id}`} className="font-mono text-xs text-ink-2 hover:underline">
                        {poNumber(o.seq)}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 align-top max-w-[22rem]">
                      <Link href={`/operations/vendor-orders/${o.id}`} className="font-medium text-ink hover:underline line-clamp-1">
                        {o.material_needed || o.request_description}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {o.priority !== "normal" && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pr.badge}`}>{pr.label}</span>
                        )}
                        {o.payment_status !== "not_due" && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PAYMENT_STATUS_META[o.payment_status].badge}`}>
                            {PAYMENT_STATUS_META[o.payment_status].label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top text-ink-2">{o.vendor_id ? vendorMap.get(o.vendor_id) ?? "—" : "—"}</td>
                    <td className="px-3 py-2.5 align-top text-ink-2">{o.assigned_buyer_id ? buyerMap.get(o.assigned_buyer_id) ?? "—" : <span className="text-danger">Unassigned</span>}</td>
                    <td className="px-3 py-2.5 align-top">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${stageBadge(o.status)}`}>{stageLabel(o.status)}</span>
                    </td>
                    <td className="px-3 py-2.5 align-top text-ink-2 whitespace-nowrap">{fmtDate(o.needed_by)}</td>
                    <td className="px-3 py-2.5 align-top text-right tabular-nums text-ink-2 whitespace-nowrap">{fmtMoney(amount)}</td>
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

function PipelineChip({
  href, label, count, badge, active,
}: {
  href: string; label: string; count: number; badge?: string; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "flex flex-col items-start rounded-lg border px-3 py-2 transition-colors " +
        (active ? "border-ink/30 bg-sunken" : "border-line bg-white hover:bg-hover")
      }
    >
      <span className="text-lg font-semibold tabular-nums leading-none">{count}</span>
      <span className={`mt-1 text-[11px] font-medium whitespace-nowrap ${badge ? "" : "text-ink-3"}`}>{label}</span>
    </Link>
  );
}
