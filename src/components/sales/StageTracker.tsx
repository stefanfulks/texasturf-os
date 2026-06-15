"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { Deal, Stage } from "@/lib/sales/types";
import { OPEN_STAGES, STAGE_LABELS } from "@/lib/sales/labels";
import { cn } from "@/lib/utils";
import { moveDealStage } from "@/app/(app)/sales/actions";

const TRACK: Stage[] = [...OPEN_STAGES, "closed_won"];

export function StageTracker({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function move(stage: Stage) {
    if (stage === deal.stage) return;
    startTransition(async () => {
      await moveDealStage(deal.id, stage);
      router.refresh();
    });
  }

  const currentIdx = deal.stage === "closed_lost" ? -1 : TRACK.indexOf(deal.stage);

  if (deal.stage === "closed_lost") {
    return (
      <div className="card border-danger/25 bg-danger-tint/40 px-4 py-3 text-[13px] text-danger">
        Closed lost{deal.lost_reason ? ` — ${deal.lost_reason}` : ""}.{" "}
        <button
          onClick={() => move("lead")}
          disabled={pending}
          className="font-semibold underline underline-offset-2 disabled:opacity-50"
        >
          Reopen as lead
        </button>
      </div>
    );
  }

  return (
    <div className="card px-5 pb-3 pt-4">
      <div className="eyebrow mb-3">Stage tracker</div>
      <div className="flex items-start">
        {TRACK.map((stage, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          return (
            <div key={stage} className={cn("flex items-start", i > 0 && "flex-1")}>
              {i > 0 ? (
                <div
                  className={cn(
                    "mt-[9px] h-px flex-1",
                    i <= currentIdx
                      ? "bg-brand"
                      : "border-t border-dashed border-line-strong bg-transparent",
                  )}
                />
              ) : null}
              <button
                onClick={() => move(stage)}
                disabled={pending}
                title={`Move to ${STAGE_LABELS[stage]}`}
                className="group mx-1 flex w-16 flex-col items-center gap-1.5 disabled:opacity-60"
              >
                <span
                  className={cn(
                    "flex size-[18px] items-center justify-center rounded-full border-2 transition-colors",
                    done && "border-brand bg-brand text-on-brand",
                    current && "border-brand bg-surface ring-4 ring-brand-tint",
                    !done &&
                      !current &&
                      "border-line-strong bg-surface group-hover:border-brand/50",
                  )}
                >
                  {done ? <Check className="size-2.5" strokeWidth={3.5} /> : null}
                  {current ? (
                    <span className="size-1.5 rounded-full bg-brand" />
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-center text-[10.5px] font-medium leading-tight",
                    current ? "text-ink" : done ? "text-brand-strong" : "text-ink-3",
                  )}
                >
                  {STAGE_LABELS[stage]}
                  {current ? (
                    <span className="eyebrow block text-[8px] text-brand">
                      current
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
