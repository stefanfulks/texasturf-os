"use client";

import { useMemo, useState, useTransition } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Link2, FileText, Layers, Sparkles, Trash2, X, ArrowRight, GripVertical } from "lucide-react";
import { moveAdSwipe, bulkMoveAdSwipes, bulkDeleteAdSwipes, type SwipeStatus } from "./actions";
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

/** Ad Lab board. Tiles DRAG between columns (each tile is a div, not a button —
 * @hello-pangea/dnd refuses to start a drag from an interactive element) AND
 * support multi-select: tick tiles, then bulk-move or bulk-delete from the
 * floating bar. Click a tile's body to open the full pipeline panel. */
export function SwipeBoard({ swipes: initialSwipes, aiEnabled }: { swipes: MarketingAdSwipe[]; aiEnabled: boolean }) {
  const [swipes, setSwipes] = useState(initialSwipes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();
  const [bulkPending, startBulk] = useTransition();

  const openSwipe = useMemo(() => swipes.find((s) => s.id === selectedId) ?? null, [swipes, selectedId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleColumn(status: SwipeStatus) {
    const ids = swipes.filter((s) => s.status === status).map((s) => s.id);
    if (ids.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as SwipeStatus;
    if (newStatus === result.source.droppableId) return;
    setSwipes((prev) => prev.map((s) => (s.id === result.draggableId ? { ...s, status: newStatus } : s)));
    startTransition(() => { void moveAdSwipe(result.draggableId, newStatus); });
  }

  function bulkMove(status: SwipeStatus) {
    const ids = [...selected];
    setSwipes((prev) => prev.map((s) => (selected.has(s.id) ? { ...s, status } : s)));
    clearSelection();
    startBulk(() => { void bulkMoveAdSwipes(ids, status); });
  }

  function bulkDelete() {
    const ids = [...selected];
    setSwipes((prev) => prev.filter((s) => !selected.has(s.id)));
    clearSelection();
    startBulk(() => { void bulkDeleteAdSwipes(ids); });
  }

  function handleChanged(patch: Partial<MarketingAdSwipe>) {
    if (!selectedId) return;
    setSwipes((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
  }

  function handleDeleted() {
    setSwipes((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  }

  const selectedCount = selected.size;

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const items = swipes.filter((s) => s.status === col.status);
            const allSelected = items.length > 0 && items.every((s) => selected.has(s.id));
            return (
              <div key={col.status} className="flex w-64 flex-shrink-0 flex-col rounded-xl border border-line bg-hover/40">
                <div className={`flex items-center justify-between rounded-t-xl px-3 py-2.5 ${col.headerBg}`}>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                    {col.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleColumn(col.status)}
                    disabled={items.length === 0}
                    title={items.length === 0 ? "" : allSelected ? "Deselect all" : "Select all in column"}
                    className={`rounded-full border px-1.5 py-0.5 text-xs font-medium leading-none transition-colors disabled:opacity-40 ${
                      allSelected ? "border-brand-strong bg-brand text-on-brand" : "border-line bg-white text-ink-4 hover:border-line-strong"
                    }`}
                  >
                    {items.length}
                  </button>
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
                      {items.map((s, index) => {
                        const isSelected = selected.has(s.id);
                        return (
                          <Draggable key={s.id} draggableId={s.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              // Whole card is the drag handle. A <div> (not a
                              // <button>) so the dnd sensor will start the drag;
                              // it blocks drags that begin on interactive elements.
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={dragProvided.draggableProps.style}
                                onClick={() => setSelectedId(s.id)}
                                role="button"
                                tabIndex={0}
                                className={`card card-hover w-full cursor-grab p-2.5 text-left active:cursor-grabbing ${
                                  dragSnapshot.isDragging ? "rotate-1 shadow-xl" : ""
                                } ${isSelected ? "ring-2 ring-inset ring-brand/70" : ""}`}
                              >
                                <div className="flex items-start gap-2">
                                  {/* Interactive → dnd ignores it, so ticking never starts a drag */}
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => toggle(s.id)}
                                    aria-label={`Select ${s.title}`}
                                    className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-brand"
                                  />
                                  <div className="min-w-0 flex-1">
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
                                  </div>
                                  <GripVertical className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink-4/60" />
                                </div>
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

      {/* Bulk action bar — appears when anything is selected */}
      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-pop">
            <span className="text-sm font-semibold text-ink">{selectedCount} selected</span>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="text-xs text-ink-3">Move to</span>
            {COLUMNS.map((col) => (
              <button
                key={col.status}
                type="button"
                onClick={() => bulkMove(col.status)}
                disabled={bulkPending}
                className="chip chip-outline hover:border-line-strong disabled:opacity-50"
              >
                <ArrowRight className="h-3 w-3" />
                {col.label}
              </button>
            ))}
            <span className="hidden h-4 w-px bg-line sm:block" />
            <button
              type="button"
              onClick={bulkDelete}
              disabled={bulkPending}
              className="btn btn-sm bg-danger text-on-brand hover:bg-danger/90 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button type="button" onClick={clearSelection} className="btn btn-ghost btn-sm text-ink-4" aria-label="Clear selection">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {openSwipe && (
        <SwipeDetailPanel
          swipe={openSwipe}
          aiEnabled={aiEnabled}
          onClose={() => setSelectedId(null)}
          onChanged={handleChanged}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
