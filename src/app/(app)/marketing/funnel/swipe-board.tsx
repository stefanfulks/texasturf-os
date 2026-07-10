"use client";

import { useMemo, useState, useTransition } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Link2, FileText, Layers, Sparkles } from "lucide-react";
import { moveAdSwipe, type SwipeStatus } from "./actions";
import { SwipeDetailPanel } from "./swipe-detail-panel";
import type { MarketingAdSwipe } from "@/lib/db-helpers.types";

const COLUMNS: Array<{ status: SwipeStatus; label: string; dot: string; headerBg: string }> = [
  { status: "inbox",       label: "Inbox",       dot: "bg-ink-4",  headerBg: "bg-sunken" },
  { status: "transcribed", label: "Transcribed", dot: "bg-info",   headerBg: "bg-info-tint" },
  { status: "analyzed",    label: "Analyzed",    dot: "bg-warn",   headerBg: "bg-warn-tint" },
  { status: "drafted",     label: "Drafted",     dot: "bg-brand",  headerBg: "bg-brand-tint" },
];

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", other: "Other",
};

/** Ad Lab board: ads worth copying, dragged through inbox → transcribed →
 * analyzed → drafted. Click a tile for transcription, the structure breakdown,
 * and cross-brand variants. */
export function SwipeBoard({ swipes: initialSwipes, aiEnabled }: { swipes: MarketingAdSwipe[]; aiEnabled: boolean }) {
  const [swipes, setSwipes] = useState(initialSwipes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selected = useMemo(() => swipes.find((s) => s.id === selectedId) ?? null, [swipes, selectedId]);

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as SwipeStatus;
    if (newStatus === result.source.droppableId) return;
    setSwipes((prev) => prev.map((s) => (s.id === result.draggableId ? { ...s, status: newStatus } : s)));
    startTransition(() => { void moveAdSwipe(result.draggableId, newStatus); });
  }

  function handleChanged(patch: Partial<MarketingAdSwipe>) {
    if (!selectedId) return;
    setSwipes((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
  }

  function handleDeleted() {
    setSwipes((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const items = swipes.filter((s) => s.status === col.status);
            return (
              <div key={col.status} className="flex w-64 flex-shrink-0 flex-col rounded-xl border border-line bg-hover/40">
                <div className={`flex items-center justify-between rounded-t-xl px-3 py-2.5 ${col.headerBg}`}>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                    {col.label}
                  </span>
                  <span className="rounded-full border border-line bg-white px-1.5 py-0.5 text-xs font-medium leading-none text-ink-4">
                    {items.length}
                  </span>
                </div>
                <Droppable droppableId={col.status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={"flex-1 space-y-2 p-2 transition-colors " + (snapshot.isDraggingOver ? "bg-info-tint/60" : "")}
                      style={{ minHeight: 60 }}
                    >
                      {items.length === 0 && (
                        <div className="py-6 text-center text-xs text-ink-4">
                          {snapshot.isDraggingOver ? "Drop here" : col.status === "inbox" ? "Save an ad below" : "Nothing yet"}
                        </div>
                      )}
                      {items.map((s, index) => (
                        <Draggable key={s.id} draggableId={s.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              style={dragProvided.draggableProps.style}
                              className={"transition-shadow " + (dragSnapshot.isDragging ? "rotate-1 shadow-xl" : "")}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedId(s.id)}
                                className="card card-hover w-full p-2.5 text-left"
                              >
                                <p className="text-xs font-medium leading-snug text-ink">{s.title}</p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                  {s.platform && (
                                    <span className="chip chip-outline !h-auto !py-0.5 !text-[10px]">
                                      {PLATFORM_LABEL[s.platform] ?? s.platform}
                                    </span>
                                  )}
                                  {s.source_url && <Link2 className="h-3 w-3 text-ink-4" />}
                                  {s.transcript && <FileText className="h-3 w-3 text-info" />}
                                  {s.structure != null && <Layers className="h-3 w-3 text-warn" />}
                                  {s.variants && Object.keys(s.variants as object).length > 0 && (
                                    <Sparkles className="h-3 w-3 text-brand" />
                                  )}
                                </div>
                              </button>
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
      </DragDropContext>

      {selected && (
        <SwipeDetailPanel
          swipe={selected}
          aiEnabled={aiEnabled}
          onClose={() => setSelectedId(null)}
          onChanged={handleChanged}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
