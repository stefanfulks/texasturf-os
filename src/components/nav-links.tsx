"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// ─── Configuration ────────────────────────────────────────────────────────────

type NavItem = { href: string; label: string; hint?: string };

const PERSONAL_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/tasks",     label: "Tasks" },
  { href: "/calendar",  label: "Calendar" },
  { href: "/attention", label: "Attention" },
];

const DEPARTMENTS: Array<{
  href: string;
  label: string;
  emoji: string;
  children: NavItem[];
}> = [
  {
    href: "/sales",
    label: "Sales",
    emoji: "💼",
    children: [
      { href: "/pricing",  label: "Pricing Calculator", hint: "Quote a job" },
      { href: "/projects", label: "Projects",           hint: "Active bids and customer projects" },
    ],
  },
  {
    href: "/warehouse",
    label: "Warehouse",
    emoji: "📦",
    children: [
      { href: "/inventory",              label: "Inventory Dashboard" },
      { href: "/inventory/rolls",        label: "Rolls" },
      { href: "/inventory/jobs",         label: "Jobs" },
      { href: "/inventory/receive",      label: "Receive" },
      { href: "/inventory/returns",      label: "Returns" },
      { href: "/inventory/items",        label: "Non-roll items" },
      { href: "/inventory/transactions", label: "Transaction log" },
      { href: "/inventory/reports",      label: "Reports" },
    ],
  },
  {
    href: "/office",
    label: "Office",
    emoji: "🏢",
    children: [
      { href: "/invoices",  label: "Invoices" },
      { href: "/vendors",   label: "Vendors" },
      { href: "/projects",  label: "Projects" },
      { href: "/fleet",     label: "Fleet & Equipment" },
    ],
  },
  {
    href: "/financial",
    label: "Financial",
    emoji: "💰",
    children: [
      { href: "/reports",        label: "Reports" },
      { href: "/reports/budget", label: "Budget vs Actual" },
      { href: "/reports/kpis",   label: "Manual KPIs" },
      { href: "/reports/team",   label: "Team Performance" },
    ],
  },
  {
    href: "/marketing",
    label: "Marketing",
    emoji: "📣",
    children: [
      { href: "/marketing", label: "Marketing Hub", hint: "Roadmap + shortcuts" },
    ],
  },
  {
    href: "/field",
    label: "Field",
    emoji: "🏗️",
    children: [
      { href: "/field",    label: "Field Home" },
      { href: "/tasks",    label: "My tasks" },
      { href: "/calendar", label: "My schedule" },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function NavLinks() {
  const pathname = usePathname();
  const [openDept, setOpenDept] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click outside closes any open dropdown
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDept(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Close dropdown on navigation
  useEffect(() => {
    setOpenDept(null);
  }, [pathname]);

  function isPersonalActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + "/");
  }
  function isDeptActive(d: (typeof DEPARTMENTS)[number]): boolean {
    if (pathname === d.href || pathname.startsWith(d.href + "/")) return true;
    return d.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"));
  }

  return (
    <nav ref={containerRef} className="flex items-center gap-1 text-sm">
      {/* Personal */}
      {PERSONAL_LINKS.map((link) => {
        const active = isPersonalActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              "rounded-md px-2.5 py-1.5 transition-colors " +
              (active
                ? "font-semibold text-zinc-900 bg-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50")
            }
          >
            {link.label}
          </Link>
        );
      })}

      {/* Subtle divider */}
      <span className="mx-2 h-5 w-px bg-zinc-200" aria-hidden="true" />

      {/* Department dropdowns */}
      {DEPARTMENTS.map((dept) => {
        const isOpen = openDept === dept.label;
        const active = isDeptActive(dept);
        return (
          <div key={dept.label} className="relative">
            <button
              type="button"
              onClick={() => setOpenDept(isOpen ? null : dept.label)}
              aria-haspopup="true"
              aria-expanded={isOpen}
              className={
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors " +
                (active
                  ? "font-semibold text-zinc-900 bg-zinc-100"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50")
              }
            >
              {dept.label}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden"
              >
                <Link
                  href={dept.href}
                  role="menuitem"
                  className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{dept.emoji}</span>
                    <span className="font-semibold text-zinc-900">{dept.label} home</span>
                  </span>
                  <span className="text-xs text-zinc-400">overview →</span>
                </Link>
                <ul>
                  {dept.children.map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          role="menuitem"
                          className={
                            "flex flex-col gap-0.5 px-4 py-2 text-sm transition-colors " +
                            (isChildActive
                              ? "bg-zinc-50 text-zinc-900 font-medium"
                              : "text-zinc-700 hover:bg-zinc-50")
                          }
                        >
                          <span>{child.label}</span>
                          {child.hint && (
                            <span className="text-xs text-zinc-400">{child.hint}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
