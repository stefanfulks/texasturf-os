import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_CHIP,
  ORDER_SOURCE_LABELS,
  FULFILLMENT_LABELS,
  type OrderStatus,
  type OrderSource,
  type Fulfillment,
} from "@/lib/turfcasa/constants";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export default async function TurfcasaOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { status } = await searchParams;
  const filter = ORDER_STATUSES.includes(status as OrderStatus)
    ? (status as OrderStatus)
    : null;

  let query = supabase
    .from("turfcasa_orders")
    .select("id, order_number, customer_name, company, source, status, fulfillment, total, is_trade, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter) query = query.eq("status", filter);
  const { data: orders, error } = await query;

  // Counts for the filter pills — one grouped fetch, cheap at this scale.
  const { data: allStatuses } = await supabase
    .from("turfcasa_orders")
    .select("status")
    .limit(2000);
  const counts = new Map<string, number>();
  for (const row of allStatuses ?? []) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">TurfCasa</p>
          <h1 className="page-title">Orders</h1>
          <p className="mt-1 text-sm text-ink-2">
            Website checkouts land here as <span className="font-medium">New</span>; the
            warehouse walks them to Fulfilled. Billing happens in Jobber.
          </p>
        </div>
        <Link href="/turfcasa/orders/new" className="btn btn-primary">
          <Plus className="h-4 w-4" /> New order
        </Link>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href="/turfcasa/orders"
          className={
            "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors " +
            (!filter ? "bg-warn text-white" : "text-ink-2 hover:bg-sunken hover:text-ink")
          }
        >
          All
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/turfcasa/orders?status=${s}`}
            className={
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors " +
              (filter === s ? "bg-warn text-white" : "text-ink-2 hover:bg-sunken hover:text-ink")
            }
          >
            {ORDER_STATUS_LABELS[s]}
            {counts.get(s) ? (
              <span className="text-xs opacity-70 num">{counts.get(s)}</span>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="panel">
        {error ? (
          <div className="empty-state">
            <span className="medallion medallion-danger"><Package className="h-5 w-5" /></span>
            <p className="empty-state-title">Couldn&apos;t load orders</p>
            <p className="empty-state-body">{error.message}</p>
          </div>
        ) : !orders?.length ? (
          <div className="empty-state">
            <span className="medallion medallion-warn"><Package className="h-5 w-5" /></span>
            <p className="empty-state-title">
              {filter ? `No ${ORDER_STATUS_LABELS[filter].toLowerCase()} orders` : "No orders yet"}
            </p>
            <p className="empty-state-body">
              Orders arrive from the TurfCasa website automatically, or add a phone/walk-in
              order with the button above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/turfcasa/orders/${o.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-hover transition-colors"
              >
                <span className="num w-16 flex-shrink-0 text-sm font-semibold text-ink">
                  #{o.order_number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {o.customer_name}
                    {o.company ? <span className="text-ink-3"> · {o.company}</span> : null}
                    {o.is_trade ? <span className="chip chip-warn ml-2">Trade</span> : null}
                  </span>
                  <span className="block text-xs text-ink-3">
                    {ORDER_SOURCE_LABELS[o.source as OrderSource] ?? o.source} ·{" "}
                    {FULFILLMENT_LABELS[o.fulfillment as Fulfillment] ?? o.fulfillment} ·{" "}
                    {dateFmt.format(new Date(o.created_at))}
                  </span>
                </span>
                <span className="num hidden sm:block w-24 text-right text-sm text-ink-2">
                  {o.total != null ? money.format(o.total) : "—"}
                </span>
                <span className={ORDER_STATUS_CHIP[o.status as OrderStatus] ?? "chip"}>
                  {ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
