"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Trophy, XCircle } from "lucide-react";
import type { Deal, Health, Stage } from "@/lib/sales/types";
import { OPEN_STAGES, STAGE_LABELS } from "@/lib/sales/labels";
import { usd } from "@/lib/sales/format";
import { cn } from "@/lib/utils";
import { moveDealStage } from "@/app/(app)/sales/actions";
import { DealCard } from "./DealCard";

export function PipelineBoard({
  deals,
  contactNames = {},
  ownerNames = {},
  healthById = {},
}: {
  deals: Deal[];
  contactNames?: Record<string, string>;
  ownerNames?: Record<string, string>;
  healthById?: Record<string, Health>;
}) {
  const router = useRouter();
  // Optimistic copy so a dropped card moves instantly; the server action +
  // router.refresh() reconcile it. Re-seed when the server sends new data.
  const [items, setItems] = useState<Deal[]>(deals);
  const [seed, setSeed] = useState(deals);
  if (seed !== deals) {
    setSeed(deals);
    setItems(deals);
  }

  const open = items.filter(
    (d) => d.stage !== "closed_won" && d.stage !== "closed_lost",
  );

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const stage = result.destination.droppableId as Stage;
    const id = result.draggableId;
    const current = items.find((d) => d.id === id);
    if (!current || current.stage === stage) return;

    setItems((prev) =>
      prev.map((d) => (d.id === id ? { ...d, stage } : d)),
    );
    await moveDealStage(id, stage);
    router.refresh();
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {OPEN_STAGES.map((stage) => {
          const column = open
            .filter((d) => d.stage === stage)
            .sort((a, b) => (b.value_usd ?? 0) - (a.value_usd ?? 0));
          const total = column.reduce((s, d) => s + (d.value_usd ?? 0), 0);
          return (
            <div key={stage} className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between rounded-lg bg-brand-tint/70 px-3 py-2">
                <span className="text-[12.5px] font-semibold text-brand-strong">
                  {STAGE_LABELS[stage]}
                  <span className="ml-1.5 text-[10px] tabular-nums text-brand">
                    {column.length}
                  </span>
                </span>
                <span className="eyebrow text-[9px] text-brand">{usd(total)}</span>
              </div>
              <Droppable droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "min-h-[120px] space-y-2 rounded-xl p-0.5 transition-colors",
                      snapshot.isDraggingOver && "bg-brand-tint/50",
                    )}
                  >
                    {column.map((deal, i) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={i}>
                        {(p, snap) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            {...p.dragHandleProps}
                            className={cn(snap.isDragging && "rotate-1 opacity-95")}
                          >
                            <DealCard
                              deal={deal}
                              contactName={contactNames[deal.id]}
                              ownerName={
                                deal.owner_id ? ownerNames[deal.owner_id] : null
                              }
                              health={healthById[deal.id] ?? "green"}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>

      {/* Close strip — drop a card to win or lose it. */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(["closed_won", "closed_lost"] as const).map((stage) => (
          <Droppable key={stage} droppableId={stage}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "flex h-14 items-center justify-center gap-2 rounded-[14px] border border-dashed text-[13px] font-medium transition-colors",
                  stage === "closed_won"
                    ? "border-brand-line text-brand-strong"
                    : "border-danger/30 text-danger",
                  snapshot.isDraggingOver &&
                    (stage === "closed_won" ? "bg-brand-tint" : "bg-danger-tint"),
                )}
              >
                {stage === "closed_won" ? (
                  <Trophy className="size-4" strokeWidth={2} />
                ) : (
                  <XCircle className="size-4" strokeWidth={2} />
                )}
                Drop to mark {stage === "closed_won" ? "won" : "lost"}
                <span className="hidden">{provided.placeholder}</span>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
