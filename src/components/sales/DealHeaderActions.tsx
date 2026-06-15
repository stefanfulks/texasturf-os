"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trophy, XCircle } from "lucide-react";
import type { Deal, Stage } from "@/lib/sales/types";
import { OPEN_STAGES, STAGE_LABELS } from "@/lib/sales/labels";
import { moveDealStage } from "@/app/(app)/sales/actions";

/** Advance / Won / Lost controls for an open deal header. */
export function DealHeaderActions({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function move(stage: Stage) {
    startTransition(async () => {
      await moveDealStage(deal.id, stage);
      router.refresh();
    });
  }

  const stageIdx = OPEN_STAGES.indexOf(deal.stage);
  const nextStage =
    stageIdx >= 0 && stageIdx < OPEN_STAGES.length - 1
      ? OPEN_STAGES[stageIdx + 1]
      : null;

  return (
    <div className="flex items-center gap-2">
      {nextStage ? (
        <button
          onClick={() => move(nextStage)}
          disabled={pending}
          className="btn btn-line btn-sm disabled:opacity-50"
        >
          Advance → {STAGE_LABELS[nextStage]}
        </button>
      ) : null}
      <button
        onClick={() => move("closed_won")}
        disabled={pending}
        className="btn btn-primary btn-sm disabled:opacity-50"
      >
        <Trophy className="size-3.5" /> Won
      </button>
      <button
        onClick={() => move("closed_lost")}
        disabled={pending}
        className="btn btn-line btn-sm border-danger/30 text-danger disabled:opacity-50"
      >
        <XCircle className="size-3.5" /> Lost
      </button>
    </div>
  );
}
