"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeWorkspace } from "@/lib/navigation";

/**
 * Persistent "you are here" indicator + one-click way home. The top NavLinks
 * tab bar is personalized to the VIEWER's own department, so it doesn't show
 * a tab for whatever section they're currently browsing (e.g. a sales rep
 * three levels deep in Marketing has no "Marketing" tab to click) — they had
 * to hit browser-back repeatedly. This derives the CURRENT section from the
 * URL (not the viewer's identity) and always links straight to its home page.
 */
export function SectionHome({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const ws = activeWorkspace(pathname, isAdmin);
  if (!ws) return null;

  const Icon = ws.icon;
  return (
    <Link
      href={ws.primaryHref}
      title={`Back to ${ws.label} home`}
      className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-hover"
    >
      <span className="medallion medallion-brand !h-7 !w-7 !rounded-[9px]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="hidden text-sm font-semibold text-ink sm:inline">{ws.label}</span>
    </Link>
  );
}
