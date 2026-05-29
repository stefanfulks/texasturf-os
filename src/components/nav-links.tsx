"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/tasks",     label: "Tasks"     },
  { href: "/projects",  label: "Projects"  },
  { href: "/invoices",  label: "Invoices"  },
  { href: "/reports",   label: "Reports"   },
  { href: "/fleet",     label: "Fleet"     },
  { href: "/vendors",   label: "Vendors"   },
  { href: "/attention", label: "Attention" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? "font-semibold text-zinc-900"
                : "text-zinc-500 transition-colors hover:text-zinc-900"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
