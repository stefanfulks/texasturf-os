"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FileSpreadsheet,
  Scissors,
  ClipboardList,
  RotateCcw,
  MapPin,
  FileBarChart,
  Settings,
  Boxes,
  Tag,
  Layers,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const MAIN_ITEMS: NavItem[] = [
  { href: "/inventory",         label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory/rolls",   label: "Rolls",     icon: Package },
  { href: "/inventory/receive", label: "Receive",   icon: FileSpreadsheet },
  { href: "/inventory/cut",     label: "Cut Roll",  icon: Scissors },
  { href: "/inventory/jobs",    label: "Jobs",      icon: ClipboardList },
  { href: "/inventory/returns", label: "Returns",   icon: RotateCcw },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/inventory/locations",    label: "Locations",    icon: MapPin },
  { href: "/inventory/products",     label: "Products",     icon: Layers },
  { href: "/inventory/items",        label: "Items",        icon: Boxes },
  { href: "/inventory/reports",      label: "Reports",      icon: FileBarChart },
  { href: "/inventory/transactions", label: "Transactions", icon: Tag },
  { href: "/inventory/settings",     label: "Settings",     icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/inventory") return pathname === "/inventory";
  return pathname === href || pathname.startsWith(href + "/");
}

function Pill({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors " +
        (active
          ? "bg-brand text-white"
          : "text-ink-2 hover:bg-sunken hover:text-ink")
      }
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export function InventorySubnav({ readOnly = false }: { readOnly?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Inventory navigation"
      className="flex flex-wrap items-center gap-1.5 border-b border-line pb-3"
    >
      {MAIN_ITEMS.map((item) => (
        <Pill
          key={item.href}
          href={item.href}
          label={item.label}
          Icon={item.icon}
          active={isActive(pathname, item.href)}
        />
      ))}

      <span aria-hidden="true" className="mx-2 h-5 w-px bg-line" />

      {ADMIN_ITEMS.map((item) => (
        <Pill
          key={item.href}
          href={item.href}
          label={item.label}
          Icon={item.icon}
          active={isActive(pathname, item.href)}
        />
      ))}

      {readOnly && (
        <>
          <span aria-hidden="true" className="mx-2 h-5 w-px bg-line" />
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-warn-tint text-warn border border-warn/30">
            View only
          </span>
        </>
      )}
    </nav>
  );
}
