import { ShoppingCart } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * TurfCasa web orders — paid storefront orders, newest first. Each one lands
 * here already invoiced (paid) with a warehouse pull order opened and a Slack
 * ping sent to the warehouse channel; staff advance status as they pull/fulfill.
 */

export const dynamic = "force-dynamic";

type Order = {
  id: string;
  order_number: number;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  fulfillment_method: string;
  total_cents: number;
  placed_at: string;
  invoice_id: string | null;
  pull_list_id: string | null;
};

const STATUS_CLASS: Record<string, string> = {
  paid: "bg-sunken text-ink",
  pulling: "bg-warn text-white",
  ready: "bg-sunken text-ink",
  fulfilled: "bg-sunken text-ink-2",
  cancelled: "bg-sunken text-ink-2 line-through",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function TurfcasaOrdersPage() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("turfcasa_orders")
    .select(
      "id, order_number, status, customer_name, customer_email, fulfillment_method, total_cents, placed_at, invoice_id, pull_list_id"
    )
    .order("placed_at", { ascending: false })
    .limit(200);

  const orders = (data ?? []) as Order[];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow mb-2">TurfCasa</p>
        <h1 className="page-title">Web orders</h1>
        <p className="mt-1 text-sm text-ink-2">
          Paid orders from turfcasa.com. Each arrives invoiced with a warehouse pull order opened
          and the warehouse Slack channel notified.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-warn"><ShoppingCart className="h-5 w-5" /></span>
            <p className="empty-state-title">No web orders yet</p>
            <p className="empty-state-body">
              Orders placed on turfcasa.com appear here the moment payment clears.
            </p>
          </div>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-2">
                <th className="py-2 pr-3 font-medium">Order</th>
                <th className="py-2 pr-3 font-medium">Placed</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Fulfillment</th>
                <th className="py-2 pr-3 font-medium">Total</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-hairline">
                  <td className="py-2 pr-3 font-medium text-ink">#{o.order_number}</td>
                  <td className="py-2 pr-3 text-ink-2">{when(o.placed_at)}</td>
                  <td className="py-2 pr-3 text-ink">
                    {o.customer_name || o.customer_email || "—"}
                  </td>
                  <td className="py-2 pr-3 text-ink-2 capitalize">{o.fulfillment_method}</td>
                  <td className="py-2 pr-3 text-ink">{usd(o.total_cents)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize " +
                        (STATUS_CLASS[o.status] ?? "bg-sunken text-ink-2")
                      }
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
