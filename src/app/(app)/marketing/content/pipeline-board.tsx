"use client";

import { useMemo, useState, useTransition } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { moveContentItem, type ContentDetailPatch } from "./actions";
import { ASSIGNEE_META } from "@/lib/content/assignees";
import { ContentDetailPanel } from "./content-detail-panel";
import type { ContentWithUrl } from "./page";

const STATUS_META: Record<string, { label: string; dot: string; headerBg: string }> = {
  idea:             { label: "Idea",       dot: "bg-ink-4",   headerBg: "bg-sunken" },
  scripted:         { label: "Scripted",   dot: "bg-info",    headerBg: "bg-info-tint" },
  scheduled_shoot:  { label: "Shoot",      dot: "bg-warn",    headerBg: "bg-warn-tint" },
  filmed:           { label: "Filmed",     dot: "bg-info",    headerBg: "bg-info-tint" },
  editing:          { label: "Editing",    dot: "bg-warn",    headerBg: "bg-warn-tint" },
  ready:            { label: "Ready",      dot: "bg-brand",   headerBg: "bg-brand-tint" },
  published:        { label: "Published",  dot: "bg-brand",   headerBg: "bg-brand-tint" },
};

/** Drag-and-drop content funnel board. Card face shows ONLY title, tag, and
 * who films it — click a card for the full play-by-play (shots, b-roll,
 * script, props) in a slide-over. */
export function PipelineBoard({ items: initialItems, statuses }: { items: ContentWithUrl[]; statuses: string[] }) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  function moveLocally(id: string, status: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: status as ContentWithUrl["status"] } : i)));
    startTransition(() => { void moveContentItem(id, status as Parameters<typeof moveContentItem>[1]); });
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId;
    const sourceStatus = result.source.droppableId;
    if (newStatus === sourceStatus) return;
    moveLocally(result.draggableId, newStatus);
  }

  function handleSaved(patch: ContentDetailPatch) {
    if (!selectedId) return;
    setItems((prev) => prev.map((i) => (i.id === selectedId ? { ...i, ...patch } as ContentWithUrl : i)));
    setSelectedId(null);
  }

  function handleDeleted() {
    setItems((prev) => prev.filter((i) => i.id !== selectedId));
    setSelectedId(null);
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {statuses.map((status) => {
            const meta = STATUS_META[status] ?? { label: status, dot: "bg-ink-4", headerBg: "bg-sunken" };
            const col = items.filter((i) => i.status === status);
            return (
              <div key={status} className="flex w-64 flex-shrink-0 flex-col rounded-xl border border-line bg-hover/40">
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${meta.headerBg}`}>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <span className="rounded-full border border-line bg-white px-1.5 py-0.5 text-xs font-medium leading-none text-ink-4">
                    {col.length}
                  </span>
                </div>
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={"flex-1 space-y-2 p-2 transition-colors " + (snapshot.isDraggingOver ? "bg-info-tint/60" : "")}
                      style={{ minHeight: 60 }}
                    >
                      {col.length === 0 && (
                        <div className="py-6 text-center text-xs text-ink-4">
                          {snapshot.isDraggingOver ? "Drop here" : "No ideas"}
                        </div>
                      )}
                      {col.map((item, index) => {
                        const a = item.assignee ? ASSIGNEE_META[item.assignee] : null;
                        const AIcon = a?.icon;
                        return (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={dragProvided.draggableProps.style}
                                className={"transition-shadow " + (dragSnapshot.isDragging ? "shadow-xl rotate-1" : "")}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedId(item.id)}
                                  className="card card-hover w-full p-2.5 text-left"
                                >
                                  <p className="text-xs font-medium leading-snug text-ink">{item.title}</p>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                    {item.tag && <span className="chip chip-outline !h-auto !py-0.5 !text-[10px]">{item.tag}</span>}
                                    {a && (
                                      <span className={`chip ${a.chip} !h-auto !py-0.5 !text-[10px]`}>
                                        {AIcon && <AIcon className="h-2.5 w-2.5" />}
                                        {a.label}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
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
        <ContentDetailPanel
          item={selected}
          onClose={() => setSelectedId(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
