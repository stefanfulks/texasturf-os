"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type App = {
  label: string;
  href: string;
  emoji: string;
  description: string;
  /** Path prefixes that "belong" to this workspace — used to show the
   *  switcher chip with the right label when you're deep in a tool. */
  prefixes: string[];
  comingSoon?: boolean;
  adminOnly?: boolean;
};

const APPS: readonly App[] = [
  {
    label: "TexasTurf OS",
    href: "/dashboard",
    emoji: "🏠",
    description: "Personal — tasks, calendar, attention",
    prefixes: ["/dashboard", "/tasks", "/calendar", "/attention", "/projects"],
  },
  {
    label: "Sales",
    href: "/sales",
    emoji: "💼",
    description: "Quoting, leads, customer projects",
    prefixes: ["/sales", "/pricing"],
  },
  {
    label: "Warehouse",
    href: "/warehouse",
    emoji: "📦",
    description: "Rolls, jobs, receive, cuts, returns",
    prefixes: ["/warehouse", "/inventory"],
  },
  {
    label: "Office",
    href: "/office",
    emoji: "🏢",
    description: "Invoices, vendors, fleet",
    prefixes: ["/office", "/invoices", "/vendors", "/fleet"],
  },
  {
    label: "Financial",
    href: "/financial",
    emoji: "💰",
    description: "Reports, budget, team",
    prefixes: ["/financial", "/reports"],
    adminOnly: true,
  },
  {
    label: "Marketing",
    href: "/marketing",
    emoji: "📣",
    description: "Content, SEO, reviews",
    prefixes: ["/marketing"],
    comingSoon: true,
  },
  {
    label: "Field",
    href: "/field",
    emoji: "🏗️",
    description: "Installer view: assigned work + schedule",
    prefixes: ["/field"],
  },
] as const;

function matchApp(pathname: string): App {
  // Match the most specific prefix
  const candidates = APPS.map((app) => {
    const best = app.prefixes
      .filter((p) => pathname === p || pathname.startsWith(p + "/"))
      .sort((a, b) => b.length - a.length)[0];
    return best ? { app, len: best.length } : null;
  }).filter((c): c is { app: App; len: number } => c !== null);
  if (candidates.length === 0) return APPS[0];
  candidates.sort((a, b) => b.len - a.len);
  return candidates[0].app;
}

export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const current = useMemo(() => matchApp(pathname), [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
      >
        <span className="text-sm leading-none">{current.emoji}</span>
        <span>{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Switch workspace
            </p>
          </div>
          <ul role="menu">
            {APPS.map((app) => {
              const isCurrent = app.label === current.label;
              return (
                <li key={app.label}>
                  <Link
                    href={app.href}
                    role="menuitem"
                    className={
                      "flex items-center justify-between gap-3 px-4 py-2.5 transition-colors " +
                      (isCurrent ? "bg-zinc-50" : "hover:bg-zinc-50")
                    }
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="text-lg leading-none">{app.emoji}</span>
                      <span className="min-w-0">
                        <span className={`block text-sm ${isCurrent ? "font-semibold text-zinc-900" : "text-zinc-800"}`}>
                          {app.label}
                          {isCurrent && (
                            <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                          )}
                        </span>
                        <span className="block text-xs text-zinc-400 truncate">{app.description}</span>
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-1.5">
                      {app.comingSoon && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                          soon
                        </span>
                      )}
                      {app.adminOnly && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                          admin
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
