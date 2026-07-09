import { Camera, Upload, CalendarOff } from "lucide-react";
import type { ContentWithUrl } from "./page";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Production calendar: 4 rolling weeks starting Monday of the current week.
 * A card appears on its shoot date (camera) and its publish-due date (upload).
 * Set dates by clicking a card on the Pipeline board. Server-rendered. */
export function CalendarView({ items }: { items: ContentWithUrl[] }) {
  // Monday of the current week, computed in Central time via date-only ISO.
  const now = new Date();
  const today = iso(now);
  const monday = new Date(now);
  const dow = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
  monday.setDate(now.getDate() - dow);

  const days: string[] = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(iso(d));
  }

  const byDay = new Map<string, Array<{ item: ContentWithUrl; kind: "shoot" | "due" }>>();
  for (const item of items) {
    if (item.shoot_date) {
      const list = byDay.get(item.shoot_date) ?? [];
      list.push({ item, kind: "shoot" });
      byDay.set(item.shoot_date, list);
    }
    if (item.due_date) {
      const list = byDay.get(item.due_date) ?? [];
      list.push({ item, kind: "due" });
      byDay.set(item.due_date, list);
    }
  }

  const scheduledIds = new Set(
    items.filter((i) => i.shoot_date || i.due_date).map((i) => i.id),
  );
  const unscheduled = items.filter(
    (i) => !scheduledIds.has(i.id) && i.status !== "published" && i.status !== "archived",
  );

  const inWindow = days.some((d) => (byDay.get(d)?.length ?? 0) > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-3">
        <span className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-info" /> shoot day</span>
        <span className="flex items-center gap-1.5"><Upload className="h-3.5 w-3.5 text-brand" /> publish due</span>
        <span className="text-ink-4">Set dates by opening a card on the Pipeline board.</span>
      </div>

      {!inWindow ? (
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-info">
              <CalendarOff className="h-5 w-5" />
            </span>
            <p className="empty-state-title">Nothing scheduled in the next 4 weeks</p>
            <p className="empty-state-body">
              Open any card on the Pipeline board and give it a shoot date or a publish
              due date — it shows up here.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[840px] grid-cols-7 gap-px rounded-xl border border-line bg-line">
            {DAY_LABELS.map((l) => (
              <div key={l} className="bg-sunken px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-4">
                {l}
              </div>
            ))}
            {days.map((d) => {
              const entries = byDay.get(d) ?? [];
              const isToday = d === today;
              const dayNum = Number(d.slice(8, 10));
              const isFirst = dayNum === 1;
              const month = new Date(d + "T12:00:00").toLocaleString("en-US", { month: "short" });
              return (
                <div key={d} className={`min-h-24 bg-surface p-1.5 ${isToday ? "ring-2 ring-inset ring-brand/60" : ""}`}>
                  <p className={`mb-1 text-[11px] font-semibold ${isToday ? "text-brand-strong" : "text-ink-4"}`}>
                    {isFirst ? `${month} ` : ""}{dayNum}
                  </p>
                  <div className="space-y-1">
                    {entries.map(({ item, kind }, i) => (
                      <div
                        key={`${item.id}-${kind}-${i}`}
                        className={`flex items-start gap-1 rounded-md border px-1.5 py-1 text-[11px] leading-tight ${
                          kind === "shoot" ? "border-info/40 bg-info-tint/60 text-ink-2" : "border-brand-line bg-brand-tint/60 text-ink-2"
                        }`}
                        title={item.title}
                      >
                        {kind === "shoot"
                          ? <Camera className="mt-px h-3 w-3 flex-shrink-0 text-info" />
                          : <Upload className="mt-px h-3 w-3 flex-shrink-0 text-brand" />}
                        <span className="line-clamp-2">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-4">
        {`${unscheduled.length} unpublished ${unscheduled.length === 1 ? "card" : "cards"} with no dates yet`}
        {" — they’re on the Pipeline board waiting to be scheduled."}
      </p>
    </div>
  );
}
