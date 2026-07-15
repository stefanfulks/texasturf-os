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
  // Overflow-aware collapse. The desktop tab row keeps its full intrinsic
  // width (no wrap, no shrink), so a fixed breakpoint can't know whether the
  // tabs fit — the count varies by role + department. Instead we measure: if
  // the tab row is wider than the space the header actually gives it, collapse
  // to the hamburger. This is what keeps the shell from overflowing sideways
  // at desktop browser zoom (zoom shrinks the effective CSS width, squeezing
  // the header until the tabs no longer fit).
  const slotRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);

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

  // Do the tabs fit? Compare the intrinsic width of the (hidden) full tab row
  // against the width the header grants the nav slot. Re-check whenever either
  // changes — window resize, browser zoom, font load, or a different tab set.
  const tabsKey = tabs.map((t) => t.href).join("|");
  useEffect(() => {
    const slot = slotRef.current;
    const measure = measureRef.current;
    if (!slot || !measure) return;
    const check = () => {
      // 8px of slack so we collapse just before the row would clip, not after.
      setFits(measure.scrollWidth + 8 <= slot.clientWidth);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(slot);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [tabsKey]);

  const activeTab = tabs.find((t) => isActive(pathname, t));

  return (
    <div ref={slotRef} className="relative flex min-w-0 flex-1 items-center">
      {/* Invisible measuring copy of the full tab row. The outer box is
          clipped to the slot's width so this hidden row can never push the
          page wider than the viewport (visibility:hidden still counts toward
          scrollWidth); the inner w-max row keeps its true intrinsic width,
          which we read to decide whether the real tabs fit. */}
      <div
        aria-hidden
        className="pointer-events-none invisible absolute inset-y-0 left-0 w-full overflow-hidden"
      >
        <div ref={measureRef} className="flex w-max items-center gap-1 text-sm">
          {tabs.map((tab) => (
            <span key={tab.href} className="rounded-lg border px-2.5 py-1.5 font-semibold">
              {tab.label}
              {tab.badge ? (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 align-middle text-[10px] font-bold leading-none">
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </div>

      {/* Desktop tabs — shown only when they actually fit the slot (md+). The
          w-full + overflow-hidden guarantees the row can never push the page
          wider than the viewport even before the fit check runs. */}
      <nav
        className={
          "w-full items-center gap-1 overflow-hidden text-sm " +
          (fits ? "hidden md:flex" : "hidden")
        }
      >
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                "rounded-lg border px-2.5 py-1.5 transition-all " +
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

      {/* Hamburger — below md always, and at md+ when the tabs don't fit. */}
      <div ref={ref} className={"relative " + (fits ? "md:hidden" : "")}>
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
    </div>
  );
}
