import Link from "next/link";
import type { ReactNode } from "react";
import { CheckSquare, Briefcase, Receipt, UserRound } from "lucide-react";
import { parseRefSegments, refHref, type RefType } from "@/lib/refs";

const REF_ICONS: Record<RefType, typeof CheckSquare> = {
  task: CheckSquare,
  project: Briefcase,
  invoice: Receipt,
  client: UserRound,
};

/**
 * Renders text containing `#[Label](type:id)` tokens as clickable chips.
 * Server-component safe. Plain segments pass through `renderText` when given
 * (so callers can layer @mention highlighting), else render as-is.
 */
export function RefText({
  text,
  renderText,
}: {
  text: string;
  renderText?: (text: string, key: number) => ReactNode;
}) {
  const segments = parseRefSegments(text);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return renderText ? renderText(seg.text, i) : <span key={i}>{seg.text}</span>;
        }
        const Icon = REF_ICONS[seg.ref.type];
        return (
          <Link
            key={i}
            href={refHref(seg.ref)}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-px font-medium hover:bg-indigo-100 hover:border-indigo-200 align-baseline max-w-full"
            title={seg.ref.label}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{seg.ref.label}</span>
          </Link>
        );
      })}
    </>
  );
}
