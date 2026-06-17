"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SECTION_IDS, SECTION_TITLES, type SectionId } from "@/lib/kpi-log/schemas";

export function TabNav({ pendingByTab }: { pendingByTab: Record<SectionId, number> }) {
  const sp = useSearchParams();
  const active = (sp.get("tab") ?? "material_readiness") as SectionId;
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-line pb-3">
      {SECTION_IDS.map((id) => {
        const isActive = id === active;
        const pending = pendingByTab[id] ?? 0;
        return (
          <Link
            key={id}
            href={`/operations/kpi-log?tab=${id}`}
            className={
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              (isActive
                ? "border-ink bg-brand text-white"
                : "border-line bg-white text-ink-2 hover:border-line-strong")
            }
          >
            {SECTION_TITLES[id]}
            {pending > 0 && (
              <span
                className={
                  "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] " +
                  (isActive ? "bg-white/20 text-white" : "bg-warn-tint text-warn")
                }
              >
                {pending}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
