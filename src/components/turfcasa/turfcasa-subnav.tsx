"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tags,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const ITEMS: NavItem[] = [
  { href: "/turfcasa",         label: "Overview", icon: LayoutDashboard },
  { href: "/turfcasa/orders",  label: "Orders",   icon: Package },
  { href: "/turfcasa/catalog", label: "Catalog",  icon: Tags },
];

function isActive(pathname: string, href: string) {
  if (href === "/turfcasa") return pathname === "/turfcasa";
  return pathname === href || pathname.startsWith(href + "/");
}

export function TurfcasaSubnav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors " +
              (active
                ? "bg-warn text-white"
                : "text-ink-2 hover:bg-sunken hover:text-ink")
            }
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
