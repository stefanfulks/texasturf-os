"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Each "workspace" used to be a separate hub page (e.g. /office, /sales) that
// just showed a card grid of links to the actual tools. Those hub pages were
// deleted in the layout-consolidation pass — the AppSwitcher dropdown now is
// the workspace catalog itself: click the chip and pick any tool directly.
//
//   * `primaryHref` is where you land when the workspace label is clicked.
//   * `tools` show as a compact link list under the label in the dropdown.
//   * `prefixes` decide which workspace the chip currently shows for.

type Tool = { label: string; href: string; comingSoon?: boolean };
type Workspace = {
  label: string;
  emoji: string;
  description: string;
  primaryHref: string;
  tools: Tool[];
  prefixes: string[];
  comingSoon?: boolean;
  adminOnly?: boolean;
};

const WORKSPACES: readonly Workspace[] = [
  {
    label: "TexasTurf OS",
    emoji: "🏠",
    description: "Personal — daily flow",
    primaryHref: "/dashboard",
    tools: [
      { label: "Home",      href: "/dashboard" },
      { label: "Tasks",     href: "/tasks" },
      { label: "Calendar",  href: "/calendar" },
      { label: "Meetings",  href: "/meetings" },
      { label: "Attention", href: "/attention" },
      { label: "Turfy", href: "/assistant" },
    ],
    prefixes: ["/dashboard", "/tasks", "/calendar", "/meetings", "/attention", "/assistant"],
  },
  {
    label: "Sales",
    emoji: "💼",
    description: "Quoting, leads, customer jobs",
    primaryHref: "/pricing",
    tools: [
      { label: "Pricing Calculator",   href: "/pricing" },
      { label: "Materials Calculator", href: "/sales/materials-calculator" },
      { label: "Jobs",                 href: "/jobs" },
    ],
    prefixes: ["/sales", "/pricing", "/jobs"],
  },
  {
    label: "Warehouse",
    emoji: "📦",
    description: "Rolls, jobs, receiving, cuts, daily ops",
    primaryHref: "/inventory",
    tools: [
      { label: "Inventory",             href: "/inventory" },
      { label: "Pull Lists",            href: "/operations/pull-lists" },
      { label: "Inspections",           href: "/operations/inspections" },
      { label: "Deliveries",            href: "/operations/deliveries" },
      { label: "Vehicle Maintenance",   href: "/operations/vehicles" },
      { label: "Tool Spend",            href: "/operations/tools" },
      { label: "Spend Budgets",         href: "/operations/budgets" },
      { label: "Employees",             href: "/operations/employees" },
    ],
    prefixes: ["/warehouse", "/inventory", "/operations"],
  },
  {
    label: "Office",
    emoji: "🏢",
    description: "Invoices, vendors, fleet, meetings",
    primaryHref: "/invoices",
    tools: [
      { label: "Invoices",            href: "/invoices" },
      { label: "Vendors",             href: "/vendors" },
      { label: "Fleet & Reservations", href: "/fleet" },
      { label: "Meetings",            href: "/meetings" },
      { label: "Jobs",                href: "/jobs" },
    ],
    prefixes: ["/office", "/invoices", "/vendors", "/fleet"],
  },
  {
    label: "Financial",
    emoji: "💰",
    description: "Reports, budget, team",
    primaryHref: "/reports",
    tools: [
      { label: "Reports", href: "/reports" },
      { label: "Team",    href: "/team" },
    ],
    prefixes: ["/financial", "/reports", "/team"],
    adminOnly: true,
  },
  {
    label: "Marketing",
    emoji: "📣",
    description: "Campaigns, referrals, content",
    primaryHref: "/marketing",
    tools: [
      { label: "Overview",  href: "/marketing" },
      { label: "Referrals", href: "/marketing/referrals" },
      { label: "Campaigns", href: "/marketing/campaigns", comingSoon: true },
      { label: "Content",   href: "/marketing/content",   comingSoon: true },
      { label: "Playbook",  href: "/marketing/playbook",  comingSoon: true },
    ],
    prefixes: ["/marketing"],
  },
  {
    label: "Field",
    emoji: "🏗️",
    description: "Installer view: assigned work",
    primaryHref: "/tasks",
    tools: [
      { label: "My Tasks", href: "/tasks" },
      { label: "Jobs",     href: "/jobs" },
      { label: "Calendar", href: "/calendar" },
    ],
    prefixes: ["/field"],
  },
] as const;

function matchWorkspace(pathname: string): Workspace {
  const candidates = WORKSPACES.map((ws) => {
    const best = ws.prefixes
      .filter((p) => pathname === p || pathname.startsWith(p + "/"))
      .sort((a, b) => b.length - a.length)[0];
    return best ? { ws, len: best.length } : null;
  }).filter((c): c is { ws: Workspace; len: number } => c !== null);
  if (candidates.length === 0) return WORKSPACES[0];
  candidates.sort((a, b) => b.len - a.len);
  return candidates[0].ws;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const current = useMemo(() => matchWorkspace(pathname), [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
        <div className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden max-h-[80vh] overflow-y-auto">
          <div className="px-4 py-2 border-b border-zinc-100 sticky top-0 bg-white">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Jump to anything
            </p>
          </div>
          <ul role="menu" className="divide-y divide-zinc-100">
            {WORKSPACES.map((ws) => {
              const isCurrent = ws.label === current.label;
              return (
                <li key={ws.label} className="py-1">
                  <Link
                    href={ws.primaryHref}
                    role="menuitem"
                    className={
                      "flex items-center justify-between gap-3 px-4 py-2 transition-colors " +
                      (isCurrent ? "bg-zinc-50" : "hover:bg-zinc-50")
                    }
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base leading-none">{ws.emoji}</span>
                      <span className="min-w-0">
                        <span className={`block text-sm ${isCurrent ? "font-semibold text-zinc-900" : "text-zinc-800"}`}>
                          {ws.label}
                          {isCurrent && (
                            <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                          )}
                        </span>
                        <span className="block text-[11px] text-zinc-400 truncate">{ws.description}</span>
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-1.5">
                      {ws.comingSoon && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                          soon
                        </span>
                      )}
                      {ws.adminOnly && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                          admin
                        </span>
                      )}
                    </span>
                  </Link>

                  {/* Tools list — direct deep-links so users don't bounce
                      through an intermediary hub page. */}
                  {ws.tools.length > 0 && (
                    <div className="pl-12 pr-3 pb-1.5 flex flex-wrap gap-1">
                      {ws.tools.map((tool) => {
                        const active = isActive(pathname, tool.href);
                        if (tool.comingSoon) {
                          return (
                            <span
                              key={tool.href}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-400 bg-zinc-50 cursor-default select-none"
                              title="Coming soon"
                            >
                              {tool.label}
                              <span className="text-[9px] uppercase tracking-wide text-zinc-400">soon</span>
                            </span>
                          );
                        }
                        return (
                          <Link
                            key={tool.href}
                            href={tool.href}
                            className={
                              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors " +
                              (active
                                ? "bg-zinc-900 text-white"
                                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900")
                            }
                          >
                            {tool.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
