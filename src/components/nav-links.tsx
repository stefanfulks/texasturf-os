"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

/**
 * Top-level tabs for TexasTurf OS (the personal workspace). Department
 * workspaces (Sales / Warehouse / Office / Financial / Marketing / Field)
 * are reached via the AppSwitcher chip to the left of these tabs.
 *
 * On mobile the row collapses to a hamburger that opens a dropdown.
 */
const PERSONAL_TABS: Array<{ href: string; label: string; prefixes?: string[] }> = [
  { href: "/dashboard", label: "Home",      prefixes: ["/dashboard", "/"] },
  { href: "/tasks",     label: "Tasks",     prefixes: ["/tasks"] },
  { href: "/calendar",  label: "Calendar",  prefixes: ["/calendar"] },
  { href: "/attention", label: "Attention", prefixes: ["/attention"] },
  { href: "/projects",  label: "Projects",  prefixes: ["/projects"] },
  { href: "/assistant", label: "Assistant", prefixes: ["/assistant"] },
];

function isActive(pathname: string, tab: { href: string; prefixes?: string[] }): boolean {
  const prefixes = tab.prefixes ?? [tab.href];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + on route change
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  const activeTab = PERSONAL_TABS.find((t) => isActive(pathname, t));

  return (
    <>
      {/* Desktop tabs (md+) */}
      <nav className="hidden md:flex items-center gap-1 text-sm">
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

      {/* Mobile hamburger (< md) */}
      <div ref={ref} className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open menu"
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          <span>{activeTab?.label ?? "Menu"}</span>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-40 mt-1.5 w-48 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
            {PERSONAL_TABS.map((tab) => {
              const active = isActive(pathname, tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={
                    "block px-4 py-2.5 text-sm transition-colors " +
                    (active
                      ? "font-semibold text-zinc-900 bg-zinc-50"
                      : "text-zinc-700 hover:bg-zinc-50")
                  }
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
