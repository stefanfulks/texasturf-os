import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Store,
  Package,
  Tags,
  ArrowRight,
  ClipboardList,
  Boxes,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_CHIP,
  type OrderStatus,
} from "@/lib/turfcasa/constants";

/**
 * TurfCasa overview — the outlet's home page. Jobber stays the system of
 * record for quotes/invoices/billing; this section runs what Jobber can't:
 * website order intake and warehouse fulfillment.
 */
export default async function TurfcasaOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgo = weekAgoDate.toISOString();
  const [newRes, activeRes, readyRes, weekRes, recentRes] = await Promise.all([
    supabase
      .from("turfcasa_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("turfcasa_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["confirmed", "picking"]),
    supabase
      .from("turfcasa_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "ready"),
    supabase
      .from("turfcasa_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "fulfilled")
      .gte("updated_at", weekAgo),
    supabase
      .from("turfcasa_orders")
      .select("id, order_number, customer_name, company, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const stats = [
    { label: "New orders", value: newRes.count ?? 0, foot: "awaiting confirmation", href: "/turfcasa/orders?status=new" },
    { label: "In progress", value: activeRes.count ?? 0, foot: "confirmed or picking", href: "/turfcasa/orders?status=picking" },
    { label: "Ready", value: readyRes.count ?? 0, foot: "for pickup / delivery", href: "/turfcasa/orders?status=ready" },
    { label: "Fulfilled", value: weekRes.count ?? 0, foot: "last 7 days", href: "/turfcasa/orders?status=fulfilled" },
  ];

  return (
    <div className="space-y-6">
      {/* Brand hero */}
      <div className="hero-band p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow mb-2 flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5" aria-hidden />
              TurfCasa — Trade Outlet · Lakeway, TX
            </p>
            <h1 className="page-title">The Trade&apos;s Turf Source</h1>
            <p className="mt-2 max-w-xl text-sm text-ink-2">
              Turf and accessories at trade pricing, in stock, ready today.
              TexasTurf installs — TurfCasa supplies. Core promise:{" "}
              <span className="font-semibold text-ink">we never hold up your crew.</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/turfcasa/orders/new" className="btn btn-primary">
              New order
            </Link>
            <Link href="/turfcasa/orders" className="btn">
              Order board
            </Link>
            <Link href="/sales/dialer/new?brand=turfcasa" className="btn">
              Call customers
            </Link>
          </div>
        </div>
      </div>

      {/* Live order pipeline */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="stat stat-accent-warn">
            <p className="stat-label">{s.label}</p>
            <p className="stat-value num">{s.value}</p>
            <p className="stat-foot">{s.foot}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent orders */}
        <div className="panel">
          <div className="panel-head flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Recent orders</p>
            <Link href="/turfcasa/orders" className="text-xs font-medium text-ink-3 hover:text-ink transition-colors">
              View all
            </Link>
          </div>
          {!recentRes.data?.length ? (
            <div className="empty-state">
              <span className="medallion medallion-warn"><Package className="h-5 w-5" /></span>
              <p className="empty-state-title">No orders yet</p>
              <p className="empty-state-body">
                Website checkouts land here automatically once the site is wired to the
                order endpoint; phone and walk-in orders start with “New order.”
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {recentRes.data.map((o) => (
                <Link
                  key={o.id}
                  href={`/turfcasa/orders/${o.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-hover transition-colors"
                >
                  <span className="num w-14 flex-shrink-0 text-sm font-semibold text-ink">
                    #{o.order_number}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {o.customer_name}
                    {o.company ? <span className="text-ink-3"> · {o.company}</span> : null}
                  </span>
                  <span className={ORDER_STATUS_CHIP[o.status as OrderStatus] ?? "chip"}>
                    {ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* How the tools split */}
        <div className="panel p-5">
          <p className="eyebrow mb-3">Runs here vs. Jobber</p>
          <div className="space-y-1">
            {[
              { href: "/turfcasa/orders",  icon: Package,       label: "Orders",    body: "Website + phone + walk-in orders, warehouse fulfillment trail." },
              { href: "/turfcasa/catalog", icon: Tags,          label: "Catalog",   body: "Trade & retail price per SKU — feeds order entry and the website." },
              { href: "/inventory",        icon: Boxes,         label: "Inventory", body: "Roll stock and warehouse storage (shared with TexasTurf)." },
              { href: "/tasks",            icon: ClipboardList, label: "Tasks",     body: "One team, one task list — assign across both brands." },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-hover"
                >
                  <span className="medallion medallion-warn">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{t.label}</span>
                    <span className="block truncate text-xs text-ink-3">{t.body}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-brand-line bg-brand-tint p-3.5">
            <span className="medallion medallion-brand flex-shrink-0">
              <ExternalLink className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-xs leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">Quotes, invoices, and payments stay in Jobber</span>{" "}
              — it remains the system of record for billing. Link the Jobber invoice number on
              an order so the two always reconcile. Installations stay with TexasTurf.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
