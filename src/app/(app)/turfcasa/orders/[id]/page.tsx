import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Globe, Phone, Store, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_CHIP,
  ORDER_SOURCE_LABELS,
  FULFILLMENT_LABELS,
  PRODUCT_UNIT_LABELS,
  type OrderStatus,
  type OrderSource,
  type Fulfillment,
  type ProductUnit,
} from "@/lib/turfcasa/constants";
import { OrderControls } from "./order-controls";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

const SOURCE_ICON = { website: Globe, phone: Phone, walk_in: Store } as const;

export default async function TurfcasaOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [{ data: order }, { data: lines }, { data: events }] = await Promise.all([
    supabase.from("turfcasa_orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("turfcasa_order_lines")
      .select("*")
      .eq("order_id", id)
      .order("sort_order"),
    supabase
      .from("turfcasa_order_events")
      .select("*, actor_profile:profiles(full_name)")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!order) notFound();

  const SourceIcon = SOURCE_ICON[order.source as OrderSource] ?? Store;
  const lineTotal = (lines ?? []).reduce(
    (sum, l) => sum + (l.unit_price ?? 0) * l.qty,
    0,
  );

  return (
    <div className="space-y-5">
      <Link
        href="/turfcasa/orders"
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <SourceIcon className="h-3.5 w-3.5" aria-hidden />
            {ORDER_SOURCE_LABELS[order.source as OrderSource] ?? order.source} order ·{" "}
            {FULFILLMENT_LABELS[order.fulfillment as Fulfillment] ?? order.fulfillment}
          </p>
          <h1 className="page-title num">Order #{order.order_number}</h1>
        </div>
        <span className={ORDER_STATUS_CHIP[order.status as OrderStatus] ?? "chip"}>
          {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Lines */}
          <div className="panel">
            <div className="panel-head">
              <p className="text-sm font-semibold text-ink">Items</p>
            </div>
            <div className="divide-y divide-line">
              {(lines ?? []).map((l) => (
                <div key={l.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="min-w-0 flex-1 text-sm text-ink">{l.name}</span>
                  <span className="num text-sm text-ink-2">
                    {l.qty} {PRODUCT_UNIT_LABELS[l.unit as ProductUnit] ?? l.unit}
                  </span>
                  <span className="num w-20 text-right text-sm text-ink-2">
                    {l.unit_price != null ? money.format(l.unit_price) : "—"}
                  </span>
                  <span className="num w-24 text-right text-sm font-medium text-ink">
                    {l.unit_price != null ? money.format(l.unit_price * l.qty) : "—"}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-end gap-4 px-5 py-3">
                <span className="text-sm text-ink-2">Total (informational)</span>
                <span className="num text-base font-semibold text-ink">
                  {order.total != null ? money.format(order.total) : money.format(lineTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Warehouse controls */}
          <div className="panel p-5">
            <p className="eyebrow mb-3">Warehouse</p>
            <OrderControls
              orderId={order.id}
              status={order.status as OrderStatus}
              jobberInvoiceNumber={order.jobber_invoice_number}
            />
          </div>

          {/* Trail */}
          <div className="panel p-5">
            <p className="eyebrow mb-3">History</p>
            <div className="space-y-2.5">
              {(events ?? []).map((e) => {
                const who =
                  (e as { actor_profile?: { full_name: string | null } | null })
                    .actor_profile?.full_name ?? "Website";
                return (
                  <div key={e.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warn" aria-hidden />
                    <span className="min-w-0 flex-1 text-ink-2">
                      {e.event === "created" ? (
                        <>Order created</>
                      ) : e.event === "status_changed" ? (
                        <>
                          {ORDER_STATUS_LABELS[e.from_status as OrderStatus] ?? e.from_status}
                          {" → "}
                          <span className="font-medium text-ink">
                            {ORDER_STATUS_LABELS[e.to_status as OrderStatus] ?? e.to_status}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink">{e.note}</span>
                      )}
                      <span className="text-ink-4"> · {who} · {dateTimeFmt.format(new Date(e.created_at))}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Customer card */}
        <div className="space-y-4">
          <div className="panel p-5">
            <p className="eyebrow mb-3">Customer</p>
            <div className="flex items-center gap-3">
              <span className="medallion medallion-warn"><User className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {order.customer_name}
                  {order.is_trade ? <span className="chip chip-warn ml-2">Trade</span> : null}
                </p>
                {order.company ? <p className="truncate text-xs text-ink-3">{order.company}</p> : null}
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              {order.customer_phone ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Phone</dt>
                  <dd className="num text-ink">{order.customer_phone}</dd>
                </div>
              ) : null}
              {order.customer_email ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Email</dt>
                  <dd className="truncate text-ink">{order.customer_email}</dd>
                </div>
              ) : null}
              {order.requested_date ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Requested</dt>
                  <dd className="text-ink">{order.requested_date}</dd>
                </div>
              ) : null}
              {order.delivery_address ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Deliver to</dt>
                  <dd className="text-right text-ink">{order.delivery_address}</dd>
                </div>
              ) : null}
              {order.jobber_invoice_number ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Jobber invoice</dt>
                  <dd className="num text-ink">#{order.jobber_invoice_number}</dd>
                </div>
              ) : null}
            </dl>
            {order.notes ? (
              <p className="mt-4 rounded-xl bg-sunken px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
                {order.notes}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
