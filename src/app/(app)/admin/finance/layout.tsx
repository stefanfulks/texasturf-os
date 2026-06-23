import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-role";

const FIN_NAV = [
  { href: "/admin/finance",             label: "Home" },
  { href: "/admin/finance/budget",      label: "Budget P&L" },
  { href: "/admin/finance/sales-trend", label: "Sales Trend" },
  { href: "/admin/finance/break-even",  label: "Break-even" },
  { href: "/admin/finance/pricing",     label: "Pricing" },
  { href: "/admin/finance/labor",       label: "Labor" },
  { href: "/admin/finance/cash-flow",   label: "Cash Flow" },
  { href: "/admin/finance/import",      label: "Import" },
  { href: "/admin/finance/settings",    label: "Settings" },
];

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <nav className="flex flex-wrap gap-1 text-sm border-b border-line pb-2">
        {FIN_NAV.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-lg px-2.5 py-1.5 text-ink-3 hover:text-ink hover:bg-hover">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
