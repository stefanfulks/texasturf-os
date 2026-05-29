"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type App = {
  label: string;
  href: string;
  comingSoon: boolean;
  adminOnly: boolean;
};

const APPS: readonly App[] = [
  {
    label: "TexasTurf OS",
    href: "/",
    comingSoon: false,
    adminOnly: false,
  },
  {
    label: "Inventory",
    href: "/inventory",
    comingSoon: false,
    adminOnly: false,
  },
  {
    label: "Marketing",
    href: "/marketing",
    comingSoon: true,
    adminOnly: false,
  },
  {
    label: "Financials",
    href: "/financials",
    comingSoon: true,
    adminOnly: true,
  },
] as const;

function isCurrentApp(pathname: string, href: string) {
  if (href === "/") {
    // TexasTurf OS is the catch-all — current when not inside any other named app.
    return !APPS.some(
      (a) => a.href !== "/" && (pathname === a.href || pathname.startsWith(a.href + "/")),
    );
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const currentLabel = useMemo(() => {
    const current = APPS.find((a) => isCurrentApp(pathname, a.href));
    return current?.label ?? "TexasTurf OS";
  }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-zinc-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-zinc-700 transition-colors"
      >
        {currentLabel}
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 z-50">
          {APPS.map((app) => {
            const current = isCurrentApp(pathname, app.href);
            return (
            <Link
              key={app.href}
              href={app.href}
              onClick={() => setOpen(false)}
              className="bg-white hover:bg-zinc-50 px-4 py-2.5 text-sm flex items-center justify-between group transition-colors"
            >
              <span className="flex items-center gap-2">
                {current && (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0" />
                )}
                {!current && (
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent shrink-0" />
                )}
                <span className={current ? "font-semibold text-zinc-900" : "text-zinc-700"}>
                  {app.label}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                {app.comingSoon && (
                  <span className="text-xs bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded">
                    soon
                  </span>
                )}
                {app.adminOnly && (
                  <span className="text-xs bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded">
                    admin
                  </span>
                )}
              </span>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
