"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import type { Department } from "@/lib/departments";

/**
 * Top-level navigation tabs. The UserMenu (left of these tabs) holds the
 * full workspace catalog and identity affordances; the gear icon (right of
 * notifications) opens /settings. These tabs are the high-frequency
 * destinations everyone needs one click away.
 *
 * Tabs are ordered around the user's PRIMARY department so each person's
 * daily pages are one click away (field → Today first, office → Invoices,
 * warehouse → Operations…). Falls back to the generalist set when no
 * department is picked. Every set ends with Turfy; Feedback is spliced in
 * just before it, and the Team tab is appended for admins.
 *
 * The (app) layout fetches role + departments server-side and passes
 * `isAdmin` / `department` here.
 */
type NavTab = { href: string; label: string; prefixes?: string[]; badge?: number };

const PERSONAL_TABS_BASE: NavTab[] = [
  { href: "/dashboard",          label: "Home",      prefixes: ["/dashboard", "/"] },
  { href: "/tasks",              label: "Tasks",     prefixes: ["/tasks"] },
  { href: "/calendar",           label: "Calendar",  prefixes: ["/calendar"] },
  { href: "/meetings",           label: "Meetings",  prefixes: ["/meetings"] },
  { href: "/fleet/reservations", label: "Vehicles",  prefixes: ["/fleet/reservations"] },
  { href: "/jobs",               label: "Jobs",      prefixes: ["/jobs"] },
  { href: "/attention",          label: "Attention", prefixes: ["/attention"] },
  { href: "/assistant",          label: "Turfy",     prefixes: ["/assistant"] },
];

// Daily-workflow tab sets per department. Keep each ≤7 before Feedback/Team
// get spliced in — more than that stops being "one click away".
const DEPT_TABS: Partial<Record<Department, NavTab[]>> = {
  field: [
    { href: "/today",              label: "Today",     prefixes: ["/today", "/install"] },
    { href: "/tasks",              label: "Tasks",     prefixes: ["/tasks"] },
    { href: "/jobs",               label: "Jobs",      prefixes: ["/jobs"] },
    { href: "/calendar",           label: "Calendar",  prefixes: ["/calendar"] },
    { href: "/fleet/reservations", label: "Vehicles",  prefixes: ["/fleet/reservations"] },
    { href: "/assistant",          label: "Turfy",     prefixes: ["/assistant"] },
  ],
  warehouse: [
    { href: "/dashboard",  label: "Home",       prefixes: ["/dashboard", "/"] },
    { href: "/operations", label: "Operations", prefixes: ["/operations"] },
    { href: "/inventory",  label: "Inventory",  prefixes: ["/inventory"] },
    { href: "/tasks",      label: "Tasks",      prefixes: ["/tasks"] },
    { href: "/calendar",   label: "Calendar",   prefixes: ["/calendar"] },
    { href: "/assistant",  label: "Turfy",      prefixes: ["/assistant"] },
  ],
  office: [
    { href: "/dashboard", label: "Home",      prefixes: ["/dashboard", "/"] },
    { href: "/invoices",  label: "Invoices",  prefixes: ["/invoices"] },
    { href: "/tasks",     label: "Tasks",     prefixes: ["/tasks"] },
    { href: "/meetings",  label: "Meetings",  prefixes: ["/meetings"] },
    { href: "/calendar",  label: "Calendar",  prefixes: ["/calendar"] },
    { href: "/attention", label: "Attention", prefixes: ["/attention"] },
    { href: "/assistant", label: "Turfy",     prefixes: ["/assistant"] },
  ],
  sales: [
    { href: "/dashboard", label: "Home",     prefixes: ["/dashboard", "/"] },
    { href: "/pitch",     label: "Pitch",    prefixes: ["/pitch", "/present"] },
    { href: "/pricing",   label: "Pricing",  prefixes: ["/pricing"] },
    { href: "/clients",   label: "Clients",  prefixes: ["/clients"] },
    { href: "/sales",       label: "Sales",  prefixes: ["/sales"] },
    { href: "/sales/inbox", label: "Inbox",  prefixes: ["/sales/inbox"] },
    { href: "/jobs",      label: "Jobs",     prefixes: ["/jobs"] },
    { href: "/tasks",     label: "Tasks",    prefixes: ["/tasks"] },
    { href: "/assistant", label: "Turfy",    prefixes: ["/assistant"] },
  ],
  financial: [
    { href: "/dashboard", label: "Home",      prefixes: ["/dashboard", "/"] },
    { href: "/reports",   label: "Reports",   prefixes: ["/reports"] },
    { href: "/invoices",  label: "Invoices",  prefixes: ["/invoices"] },
    { href: "/tasks",     label: "Tasks",     prefixes: ["/tasks"] },
    { href: "/calendar",  label: "Calendar",  prefixes: ["/calendar"] },
    { href: "/attention", label: "Attention", prefixes: ["/attention"] },
    { href: "/assistant", label: "Turfy",     prefixes: ["/assistant"] },
  ],
  marketing: [
    { href: "/dashboard", label: "Home",      prefixes: ["/dashboard", "/"] },
    { href: "/marketing", label: "Marketing", prefixes: ["/marketing"] },
    { href: "/tasks",     label: "Tasks",     prefixes: ["/tasks"] },
    { href: "/calendar",  label: "Calendar",  prefixes: ["/calendar"] },
    { href: "/meetings",  label: "Meetings",  prefixes: ["/meetings"] },
    { href: "/assistant", label: "Turfy",     prefixes: ["/assistant"] },
  ],
};

// Feedback tab is per-role:
//   admin → goes straight to the triage inbox (/admin/feedback)
//   everyone else → personal feedback page (/feedback)
// Either way, the tab matches BOTH paths so it stays highlighted no
// matter which one is currently active.
const FEEDBACK_PREFIXES = ["/feedback", "/admin/feedback"];

const ADMIN_TABS: NavTab[] = [
  { href: "/admin/finance", label: "Finance", prefixes: ["/admin/finance"] },
  { href: "/team", label: "Team", prefixes: ["/team", "/admin/users"] },
];

function isActive(pathname: string, tab: NavTab): boolean {
  const prefixes = tab.prefixes ?? [tab.href];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function NavLinks({
  isAdmin = false,
  department = null,
  feedbackCount = 0,
}: {
  isAdmin?: boolean;
  department?: Department | null;
  feedbackCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const feedbackTab: NavTab = {
    href:     isAdmin ? "/admin/feedback" : "/feedback",
    label:    "Feedback",
    prefixes: FEEDBACK_PREFIXES,
    badge:    feedbackCount > 0 ? feedbackCount : undefined,
  };
  // Department-ordered base (daily pages first), falling back to the
  // generalist set. Every base ends with Turfy — slot Feedback just before
  // it, then append admin tabs.
  const base = (department && DEPT_TABS[department]) || PERSONAL_TABS_BASE;
  const tabs: NavTab[] = isAdmin
    ? [...base.slice(0, -1), feedbackTab, base.at(-1)!, ...ADMIN_TABS]
    : [...base.slice(0, -1), feedbackTab, base.at(-1)!];

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
      {/* Desktop tabs (md+). flex-1/min-w-0 bounds this to the space the layout
          hands it; overflow-x-auto turns any excess into a scroll lane so tabs
          never spill onto the search/bell/gear cluster (many-tab roles or
          browser zoom). Scrollbar hidden to keep the bar clean; each tab is
          shrink-0 so labels stay full-size and legible. */}
      <nav className="hidden md:flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                "shrink-0 rounded-lg border px-2.5 py-1.5 transition-all " +
                (active
                  ? "border-line bg-surface font-semibold text-ink shadow-e1"
                  : "border-transparent text-ink-3 hover:bg-hover hover:text-ink")
              }
            >
              {tab.label}
              {tab.badge ? (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 align-middle text-[10px] font-bold leading-none text-white">
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              ) : null}
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-medium text-ink-2 shadow-e1"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          <span>{activeTab?.label ?? "Menu"}</span>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-40 mt-1.5 w-48 rounded-2xl border border-line bg-surface shadow-pop overflow-hidden">
            {tabs.map((tab) => {
              const active = isActive(pathname, tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={
                    "relative flex items-center justify-between px-4 py-2.5 text-sm transition-colors " +
                    (active
                      ? "bg-brand-tint font-semibold text-brand-strong before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-brand"
                      : "text-ink-2 hover:bg-hover")
                  }
                >
                  <span>{tab.label}</span>
                  {tab.badge ? (
                    <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white">
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
