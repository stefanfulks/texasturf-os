/**
 * THE app map — single source of truth for navigation.
 *
 * Consumed by:
 *   - UserMenu ("Go to" workspace catalog in the top bar)
 *   - CommandPalette (⌘K page jumps)
 *
 * Organizing model: one workspace per department (matching `lib/departments`),
 * plus Personal (everyone's own pages), Field, and the admin-gated Financial +
 * Admin workspaces. A tool may appear in more than one workspace when more
 * than one department genuinely uses it (Clients lives in Sales AND Office) —
 * the palette dedupes by href.
 *
 * When you add a page to the app, add it HERE — both surfaces update at once.
 */
import {
  Home, Briefcase, Warehouse, Building2, HardHat, Megaphone, Banknote,
  ShieldCheck, type LucideIcon,
} from "lucide-react";

export type NavTool = { label: string; href: string };

export type NavWorkspace = {
  label: string;
  icon: LucideIcon;
  primaryHref: string;
  tools: NavTool[];
  /** Path prefixes that mark this workspace "active". Order of WORKSPACES
   * matters for overlapping prefixes (Financial's /admin/finance must be
   * matched before Admin's /admin). */
  prefixes: string[];
  adminOnly?: boolean;
};

export const NAV_WORKSPACES: readonly NavWorkspace[] = [
  {
    label: "Personal",
    icon: Home,
    primaryHref: "/dashboard",
    tools: [
      { label: "Home",      href: "/dashboard" },
      { label: "Agenda",    href: "/agenda" },
      { label: "Tasks",     href: "/tasks" },
      { label: "Recurring", href: "/tasks/recurring" },
      { label: "Calendar",  href: "/calendar" },
      { label: "Meetings",  href: "/meetings" },
      { label: "Attention", href: "/attention" },
      { label: "Feedback",  href: "/feedback" },
      { label: "Turfy",     href: "/assistant" },
    ],
    prefixes: ["/dashboard", "/agenda", "/tasks", "/calendar", "/meetings", "/attention", "/feedback", "/assistant"],
  },
  {
    label: "Sales",
    icon: Briefcase,
    primaryHref: "/sales",
    tools: [
      { label: "Pipeline",             href: "/sales" },
      { label: "Inbox",                href: "/sales/inbox" },
      { label: "Pitch",                href: "/pitch" },
      { label: "Pricing Calculator",   href: "/pricing" },
      { label: "Materials Calculator", href: "/sales/materials-calculator" },
      { label: "Clients",              href: "/clients" },
      { label: "Jobs",                 href: "/jobs" },
    ],
    prefixes: ["/sales", "/pitch", "/pricing", "/jobs", "/clients"],
  },
  {
    label: "Warehouse",
    icon: Warehouse,
    primaryHref: "/operations",
    tools: [
      { label: "Operations Today",     href: "/operations" },
      { label: "Inventory",            href: "/inventory" },
      { label: "Pull Lists",           href: "/operations/pull-lists" },
      { label: "Deliveries",           href: "/operations/deliveries" },
      { label: "Vendor Orders",        href: "/operations/vendor-orders" },
      { label: "Inspections",          href: "/operations/inspections" },
      { label: "KPI Log",              href: "/operations/kpi-log" },
      { label: "Tool Spend",           href: "/operations/tools" },
      { label: "Spend Budgets",        href: "/operations/budgets" },
      { label: "Employees",            href: "/operations/employees" },
      { label: "Vehicle Maintenance",  href: "/operations/vehicles" },
      { label: "Fleet & Equipment",    href: "/fleet" },
      { label: "Vehicle Reservations", href: "/fleet/reservations" },
    ],
    prefixes: ["/inventory", "/fleet", "/operations"],
  },
  {
    label: "Office",
    icon: Building2,
    primaryHref: "/invoices",
    tools: [
      { label: "Invoices", href: "/invoices" },
      { label: "Vendors",  href: "/vendors" },
      { label: "Clients",  href: "/clients" },
      { label: "Jobs",     href: "/jobs" },
      { label: "Meetings", href: "/meetings" },
    ],
    prefixes: ["/invoices", "/vendors"],
  },
  {
    label: "Field",
    icon: HardHat,
    primaryHref: "/today",
    tools: [
      { label: "Today",                href: "/today" },
      { label: "My Tasks",             href: "/tasks" },
      { label: "Jobs",                 href: "/jobs" },
      { label: "Calendar",             href: "/calendar" },
      { label: "Vehicle Reservations", href: "/fleet/reservations" },
      { label: "Turfy",                href: "/assistant" },
    ],
    prefixes: ["/today", "/install"],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    primaryHref: "/marketing",
    tools: [
      { label: "Overview",      href: "/marketing" },
      { label: "Campaigns",     href: "/marketing/campaigns" },
      { label: "Growth Funnel", href: "/marketing/funnel" },
      { label: "Referrals",     href: "/marketing/referrals" },
      { label: "Reviews",       href: "/marketing/reviews" },
      { label: "Content",       href: "/marketing/content" },
      { label: "Playbook",      href: "/marketing/playbook" },
    ],
    prefixes: ["/marketing"],
  },
  {
    // Must precede Admin: /admin/finance would otherwise match Admin's /admin.
    label: "Financial",
    icon: Banknote,
    primaryHref: "/admin/finance",
    tools: [
      { label: "Finance Cockpit",  href: "/admin/finance" },
      { label: "Reports",          href: "/reports" },
      { label: "KPIs",             href: "/reports/kpis" },
      { label: "Budget",           href: "/reports/budget" },
      { label: "Team Performance", href: "/team" },
    ],
    prefixes: ["/admin/finance", "/reports", "/team"],
    adminOnly: true,
  },
  {
    label: "Admin",
    icon: ShieldCheck,
    primaryHref: "/admin/users",
    tools: [
      { label: "Users",           href: "/admin/users" },
      { label: "Content",         href: "/admin/content" },
      { label: "Feedback Triage", href: "/admin/feedback" },
      { label: "Jobber Settings", href: "/settings/jobber" },
    ],
    prefixes: ["/admin"],
    adminOnly: true,
  },
] as const;

/** Workspaces visible to this user. */
export function workspacesFor(isAdmin: boolean): NavWorkspace[] {
  return NAV_WORKSPACES.filter((w) => !w.adminOnly || isAdmin);
}

/** The workspace whose prefix matches the current path (first match wins). */
export function activeWorkspace(pathname: string, isAdmin: boolean): NavWorkspace | null {
  return (
    workspacesFor(isAdmin).find((w) =>
      w.prefixes.some((p) => pathname === p || pathname.startsWith(p + "/")),
    ) ?? null
  );
}

/** Flat, href-deduped page list for the ⌘K palette. Settings pages are
 * appended here (they live behind the gear icon, not in a workspace). */
export function palettePages(isAdmin: boolean): Array<{ href: string; label: string }> {
  const seen = new Set<string>();
  const out: Array<{ href: string; label: string }> = [];
  for (const ws of workspacesFor(isAdmin)) {
    for (const t of ws.tools) {
      if (seen.has(t.href)) continue;
      seen.add(t.href);
      // Generic labels get workspace context in search ("Sales · Pipeline").
      out.push({ href: t.href, label: `${ws.label} · ${t.label}` });
    }
  }
  for (const [href, label] of [
    ["/settings", "Settings"],
    ["/settings/account", "Settings · Account"],
    ["/settings/calendar", "Settings · Calendar"],
    ["/settings/meetings", "Settings · Meetings"],
    ["/settings/vehicles", "Settings · Vehicles"],
    ["/settings/pitch-tiers", "Settings · Pitch tiers"],
  ] as const) {
    if (!seen.has(href)) {
      seen.add(href);
      out.push({ href, label });
    }
  }
  return out;
}
