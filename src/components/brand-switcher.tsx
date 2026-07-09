"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * TexasTurf ↔ TurfCasa brand switcher. The two companies share one team and
 * one app; which brand you're operating is derived from the URL (everything
 * under /turfcasa is the outlet, everything else is the installer) so there's
 * no stored state to drift. TexasTurf keeps the green; TurfCasa gets the
 * amber trade-outlet accent.
 */
const BRANDS = [
  { key: "texasturf", label: "TexasTurf", short: "TT", href: "/dashboard" },
  { key: "turfcasa",  label: "TurfCasa",  short: "TC", href: "/turfcasa" },
] as const;

export function BrandSwitcher() {
  const pathname = usePathname();
  const active =
    pathname === "/turfcasa" || pathname.startsWith("/turfcasa/")
      ? "turfcasa"
      : "texasturf";

  return (
    <div
      role="group"
      aria-label="Switch brand"
      className="hidden sm:flex items-center rounded-lg border border-line bg-sunken p-0.5"
    >
      {BRANDS.map((b) => {
        const isActive = b.key === active;
        return (
          <Link
            key={b.key}
            href={b.href}
            aria-current={isActive ? "true" : undefined}
            title={isActive ? `${b.label} (current brand)` : `Switch to ${b.label}`}
            className={
              "rounded-[7px] px-2 py-1 text-xs font-semibold transition-colors " +
              (isActive
                ? b.key === "turfcasa"
                  ? "bg-surface text-warn shadow-e1"
                  : "bg-surface text-brand-strong shadow-e1"
                : "text-ink-3 hover:text-ink")
            }
          >
            <span className="hidden lg:inline">{b.label}</span>
            <span className="lg:hidden">{b.short}</span>
          </Link>
        );
      })}
    </div>
  );
}
