"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, LogOut, Settings, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Top-bar identity button. Shows the user's first name + chevron; clicking
 * opens a unified menu with:
 *   - profile snapshot (name, email, role)
 *   - workspace navigation (everything the old AppSwitcher catalog had)
 *   - direct links to Settings and Sign out
 *
 * Consolidates three previous components (AppSwitcher chip, email label,
 * Sign-out button) into one efficient affordance on the left side of the
 * top bar.
 */

type Tool = { label: string; href: string };
type Workspace = {
  label: string;
  emoji: string;
  primaryHref: string;
  tools: Tool[];
  prefixes: string[];
  adminOnly?: boolean;
  comingSoon?: boolean;
};

const WORKSPACES: readonly Workspace[] = [
  {
    label: "Personal",
    emoji: "🏠",
    primaryHref: "/dashboard",
    tools: [
      { label: "Home",      href: "/dashboard" },
      { label: "Tasks",     href: "/tasks" },
      { label: "Recurring", href: "/tasks/recurring" },
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
    primaryHref: "/pricing",
    tools: [
      { label: "Pricing Calculator",   href: "/pricing" },
      { label: "Materials Calculator", href: "/sales/materials-calculator" },
      { label: "Clients",              href: "/clients" },
      { label: "Jobs",                 href: "/jobs" },
    ],
    prefixes: ["/sales", "/pricing", "/jobs", "/clients"],
  },
  {
    label: "Warehouse",
    emoji: "📦",
    primaryHref: "/operations",
    tools: [
      { label: "Operations Today",      href: "/operations" },
      { label: "Inventory",             href: "/inventory" },
      { label: "Pull Lists",            href: "/operations/pull-lists" },
      { label: "Inspections",           href: "/operations/inspections" },
      { label: "Deliveries",            href: "/operations/deliveries" },
      { label: "Vehicle Maintenance",   href: "/operations/vehicles" },
      { label: "Tool Spend",            href: "/operations/tools" },
      { label: "Spend Budgets",         href: "/operations/budgets" },
      { label: "Employees",             href: "/operations/employees" },
      { label: "Fleet & Equipment",     href: "/fleet" },
      { label: "Vehicle Reservations",  href: "/fleet/reservations" },
    ],
    prefixes: ["/warehouse", "/inventory", "/fleet", "/operations"],
  },
  {
    label: "Office",
    emoji: "🏢",
    primaryHref: "/invoices",
    tools: [
      { label: "Invoices", href: "/invoices" },
      { label: "Vendors",  href: "/vendors" },
      { label: "Clients",  href: "/clients" },
      { label: "Meetings", href: "/meetings" },
      { label: "Jobs",     href: "/jobs" },
    ],
    prefixes: ["/office", "/invoices", "/vendors", "/clients"],
  },
  {
    label: "Marketing",
    emoji: "📣",
    primaryHref: "/marketing",
    tools: [
      { label: "Overview",  href: "/marketing" },
      { label: "Referrals", href: "/marketing/referrals" },
      { label: "Content",   href: "/marketing/content" },
      { label: "Campaigns", href: "/marketing/campaigns" },
      { label: "Reviews",   href: "/marketing/reviews" },
      { label: "Playbook",  href: "/marketing/playbook" },
    ],
    prefixes: ["/marketing"],
  },
  {
    label: "Financial",
    emoji: "💰",
    primaryHref: "/reports",
    tools: [
      { label: "Reports", href: "/reports" },
      { label: "Team",    href: "/team" },
    ],
    prefixes: ["/financial", "/reports", "/team"],
    adminOnly: true,
  },
  {
    label: "Field",
    emoji: "🏗️",
    primaryHref: "/today",
    tools: [
      { label: "Today",                href: "/today" },
      { label: "My Tasks",             href: "/tasks" },
      { label: "Jobs",                 href: "/jobs" },
      { label: "Calendar",             href: "/calendar" },
      { label: "Turfy",                href: "/assistant" },
      { label: "Vehicle Reservations", href: "/fleet/reservations" },
    ],
    prefixes: ["/field", "/today"],
  },
  {
    label: "Admin",
    emoji: "🛡️",
    primaryHref: "/admin/users",
    tools: [
      { label: "Users",            href: "/admin/users" },
      { label: "Feedback Triage",  href: "/admin/feedback" },
      { label: "Team Performance", href: "/team" },
      { label: "Jobber Settings",  href: "/settings/jobber" },
    ],
    prefixes: ["/admin"],
    adminOnly: true,
  },
] as const;

function isActiveHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function firstName(fullName: string | null, email: string): string {
  if (fullName?.trim()) return fullName.trim().split(/\s+/)[0];
  return email.split("@")[0];
}

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const palette = [
    "bg-info-tint text-info",
    "bg-info-tint text-info",
    "bg-warn-tint text-warn",
    "bg-brand-tint text-brand",
    "bg-info-tint text-info",
    "bg-info-tint text-info",
  ];
  return palette[Math.abs(h) % palette.length];
}

export function UserMenu({
  fullName,
  email,
  role,
  isAdmin,
}: {
  fullName: string | null;
  email: string;
  role: string | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [signOutPending, startSignOut] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const name = firstName(fullName, email);
  const initial = name[0]?.toUpperCase() ?? "?";

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOpen(false); }, [pathname]);

  function handleSignOut() {
    startSignOut(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  const workspaces = WORKSPACES.filter((w) => !w.adminOnly || isAdmin);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-hover transition-colors"
      >
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${colorFor(email)}`}
        >
          {initial}
        </span>
        <span className="text-sm font-semibold text-ink truncate max-w-[140px]">
          {name}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-2xl border border-line bg-surface shadow-pop overflow-hidden max-h-[80vh] overflow-y-auto">
          {/* Profile header */}
          <div className="px-4 py-3 border-b border-line bg-sunken/50">
            <div className="flex items-center gap-3">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${colorFor(email)}`}>
                {initial}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{fullName ?? name}</p>
                <p className="text-xs text-ink-3 truncate">{email}</p>
                {role && (
                  <p className="text-[10px] uppercase tracking-wider text-ink-4 mt-0.5">{role}</p>
                )}
              </div>
            </div>
          </div>

          {/* Workspaces + their tools */}
          <div className="px-2 py-2 border-b border-line">
            <p className="px-2 mb-1 eyebrow">
              Jump to anything
            </p>
            <ul className="divide-y divide-line">
              {workspaces.map((ws) => (
                <li key={ws.label} className="py-1.5">
                  <Link
                    href={ws.primaryHref}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-hover rounded-lg"
                  >
                    <span className="text-base leading-none">{ws.emoji}</span>
                    <span className="text-xs font-semibold text-ink">{ws.label}</span>
                  </Link>
                  {ws.tools.length > 0 && (
                    <div className="pl-7 pr-1 mt-1 flex flex-wrap gap-1">
                      {ws.tools.map((tool) => {
                        const active = isActiveHref(pathname, tool.href);
                        return (
                          <Link
                            key={tool.href}
                            href={tool.href}
                            className={
                              "rounded-lg px-2 py-1 text-[11px] font-medium transition-colors " +
                              (active
                                ? "bg-brand text-white"
                                : "text-ink-2 hover:bg-hover hover:text-ink")
                            }
                          >
                            {tool.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Account links */}
          <div className="py-1.5">
            <Link
              href="/settings/account"
              className="flex items-center gap-2 px-4 py-2 text-sm text-ink-2 hover:bg-hover hover:text-ink transition-colors"
            >
              <UserIcon className="h-4 w-4 text-ink-3" />
              Account
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2 px-4 py-2 text-sm text-ink-2 hover:bg-hover hover:text-ink transition-colors"
            >
              <Settings className="h-4 w-4 text-ink-3" />
              Settings
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signOutPending}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-ink-2 hover:bg-hover hover:text-ink transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 text-ink-3" />
              {signOutPending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
