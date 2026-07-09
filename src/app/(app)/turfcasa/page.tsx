import Link from "next/link";
import {
  Store,
  Users,
  FileText,
  Receipt,
  Tags,
  ArrowRight,
  ClipboardList,
  Calendar,
  HardHat,
} from "lucide-react";

/**
 * TurfCasa overview — the outlet's home page. Presentational for now: the
 * stat row goes live with the quoting/invoicing build (turfcasa_* tables);
 * until then it shows the KPI frame the brand book commits to so the numbers
 * have a home the day data arrives.
 */
export default function TurfcasaOverviewPage() {
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
            <Link href="/turfcasa/quotes" className="btn btn-primary">
              New quote
            </Link>
            <Link href="/turfcasa/accounts" className="btn">
              Enroll trade account
            </Link>
          </div>
        </div>
      </div>

      {/* KPI frame — the four numbers the brand book says this business runs on */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Trade accounts", foot: "enrolled, active" },
          { label: "Open quotes", foot: "awaiting response" },
          { label: "Awaiting payment", foot: "issued invoices" },
          { label: "Accessory attach rate", foot: "$ accessories per turf $" },
        ].map((s) => (
          <div key={s.label} className="stat stat-accent-warn">
            <p className="stat-label">{s.label}</p>
            <p className="stat-value text-ink-4">—</p>
            <p className="stat-foot">{s.foot} · live once quoting ships</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* What lives here */}
        <div className="panel p-5">
          <p className="eyebrow mb-3">Runs in TurfCasa</p>
          <div className="space-y-1">
            {[
              { href: "/turfcasa/accounts", icon: Users,    label: "Trade Accounts", body: "Builders, landscapers, contractors — pricing tier, terms, named contact." },
              { href: "/turfcasa/quotes",   icon: FileText, label: "Quotes",         body: "Line items, deposits, tax, trade pricing — Jobber-style, built in." },
              { href: "/turfcasa/invoices", icon: Receipt,  label: "Invoices",       body: "Quote-to-invoice conversion, balances, payment records." },
              { href: "/turfcasa/catalog",  icon: Tags,     label: "Catalog",        body: "Turf + accessories with trade and retail price on every SKU." },
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
        </div>

        {/* Shared with TexasTurf */}
        <div className="panel p-5">
          <p className="eyebrow mb-3">Shared with TexasTurf</p>
          <div className="space-y-1">
            {[
              { href: "/tasks",    icon: ClipboardList, label: "Tasks",           body: "One team, one task list — assign across both brands." },
              { href: "/calendar", icon: Calendar,      label: "Calendar",        body: "Meetings and scheduling stay in one place." },
              { href: "/invoices", icon: Receipt,       label: "Vendor invoices", body: "Supplier bills and approvals run through the shared office flow." },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-hover"
                >
                  <span className="medallion medallion-brand">
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
              <HardHat className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-xs leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">Installations stay with TexasTurf.</span>{" "}
              A customer who wants design-and-install is a TexasTurf conversation — hand the
              lead over. A contractor buying materials to install themselves is TurfCasa&apos;s.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
