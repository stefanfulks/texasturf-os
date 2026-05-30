import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Card for a section landing page (e.g. /warehouse, /sales). Shows an icon,
 * a title, a short description, and an optional value badge (e.g. open count).
 * Clicking the card navigates to the linked tool.
 */
export function SectionCard({
  href,
  title,
  description,
  icon,
  badge,
  accent = "neutral",
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  /** Small badge in the top-right — e.g. an unread/open count. */
  badge?: string | number | null;
  /** Color accent for the icon background. */
  accent?: "neutral" | "blue" | "green" | "amber" | "purple" | "yellow" | "emerald" | "red";
}) {
  const accentMap: Record<typeof accent, string> = {
    neutral: "bg-zinc-100 text-zinc-700",
    blue:    "bg-blue-50 text-blue-700",
    green:   "bg-green-50 text-green-700",
    amber:   "bg-amber-50 text-amber-700",
    purple:  "bg-purple-50 text-purple-700",
    yellow:  "bg-yellow-50 text-yellow-700",
    emerald: "bg-emerald-50 text-emerald-700",
    red:     "bg-red-50 text-red-700",
  };

  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentMap[accent]}`}>
          {icon}
        </div>
        {badge != null && badge !== 0 && (
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-zinc-700">
          {title}
        </h3>
        <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
      </div>
    </Link>
  );
}
