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
 * The Team tab is admin-only and gets appended by the (app) layout, which
 * fetches the user's role server-side and passes `isAdmin` here.
 */
type NavTab = { href: string; label: string; prefixes?: string[] };

const PERSONAL_TABS_BASE: NavTab[] = [
  { href: "/dashboard", label: "Home",      prefixes: ["/dashboard", "/"] },
  { href: "/tasks",     label: "Tasks",     prefixes: ["/tasks"] },
  { href: "/calendar",  label: "Calendar",  prefixes: ["/calendar"] },
  { href: "/meetings",  label: "Meetings",  prefixes: ["/meetings"] },
  { href: "/attention", label: "Attention", prefixes: ["/attention"] },
  { href: "/jobs",      label: "Jobs",      prefixes: ["/jobs"] },
  { href: "/assistant", label: "Assistant", prefixes: ["/assistant"] },
];

// Feedback tab is per-role:
//   admin → goes straight to the triage inbox (/admin/feedback)
//   everyone else → personal feedback page (/feedback)
// Either way, the tab matches BOTH paths so it stays highlighted no
// matter which one is currently active.
const FEEDBACK_PREFIXES = ["/feedback", "/admin/feedback"];

const ADMIN_TABS: NavTab[] = [
  { href: "/team", label: "Team", prefixes: ["/team", "/admin/users"] },
];

function isActive(pathname: string, tab: NavTab): boolean {
  const prefixes = tab.prefixes ?? [tab.href];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function NavLinks({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const feedbackTab: NavTab = {
    href:     isAdmin ? "/admin/feedback" : "/feedback",
    label:    "Feedback",
    prefixes: FEEDBACK_PREFIXES,
  };
  // Slot Feedback between Projects and Assistant, then append admin tabs.
  const tabs: NavTab[] = isAdmin
    ? [...PERSONAL_TABS_BASE.slice(0, -1), feedbackTab, PERSONAL_TABS_BASE.at(-1)!, ...ADMIN_TABS]
    : [...PERSONAL_TABS_BASE.slice(0, -1), feedbackTab, PERSONAL_TABS_BASE.at(-1)!];

  // Close on outside click + on route change
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOpen(false); }, [pathname]);

  const activeTab = tabs.find((t) => isActive(pathname, t));

  return (
    <>
      {/* Desktop tabs (md+) */}
      <nav className="hidden md:flex items-center gap-1 text-sm">
        {tabs.map((tab) => {
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
            {tabs.map((tab) => {
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
