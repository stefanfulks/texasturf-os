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
    neutral: "bg-sunken text-ink-2",
    blue:    "bg-info-tint text-info",
    green:   "bg-brand-tint text-brand",
    amber:   "bg-warn-tint text-warn",
    purple:  "bg-info-tint text-info",
    yellow:  "bg-warn-tint text-warn",
    emerald: "bg-brand-tint text-brand",
    red:     "bg-danger-tint text-danger",
  };

  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-xl border border-line bg-white p-5 transition-all hover:border-line-strong hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentMap[accent]}`}>
          {icon}
        </div>
        {badge != null && badge !== 0 && (
          <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-base font-semibold text-ink group-hover:text-ink-2">
          {title}
        </h3>
        <p className="mt-0.5 text-sm text-ink-3">{description}</p>
      </div>
    </Link>
  );
}
