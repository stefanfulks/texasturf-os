"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top-level tabs for TexasTurf OS (the personal workspace). Department
 * workspaces (Sales / Warehouse / Office / Financial / Marketing / Field)
 * are reached via the AppSwitcher chip to the left of these tabs.
 *
 * Keep this list tight — it's the personal "what should I do today" surface.
 */
const PERSONAL_TABS: Array<{ href: string; label: string; prefixes?: string[] }> = [
  { href: "/dashboard", label: "Home",      prefixes: ["/dashboard", "/"] },
  { href: "/tasks",     label: "Tasks",     prefixes: ["/tasks"] },
  { href: "/calendar",  label: "Calendar",  prefixes: ["/calendar"] },
  { href: "/attention", label: "Attention", prefixes: ["/attention"] },
  { href: "/projects",  label: "Projects",  prefixes: ["/projects"] },
];

function isActive(pathname: string, tab: { href: string; prefixes?: string[] }): boolean {
  const prefixes = tab.prefixes ?? [tab.href];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {PERSONAL_TABS.map((tab) => {
        const active = isActive(pathname, tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "rounded-md px-2.5 py-1.5 transition-colors " +
              (active
                ? "font-semibold text-zinc-900 bg-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
