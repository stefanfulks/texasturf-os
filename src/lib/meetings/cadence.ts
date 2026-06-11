import type { Meeting } from "./types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayName(d: number | null): string {
  return d == null ? "" : (DAYS[d] ?? "");
}

/**
 * Returns the YYYY-MM-DD of the upcoming occurrence of this meeting. If
 * today qualifies (e.g. today is the meeting's day), today is returned.
 */
export function upcomingOccurrence(
  meeting: Pick<Meeting, "cadence" | "day_of_week" | "day_of_month"> & Partial<Pick<Meeting, "scheduled_on">>,
  from: Date = new Date(),
): string {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);

  switch (meeting.cadence) {
    case "daily":
      return iso(d);

    case "once":
      // A one-time meeting has exactly one occurrence.
      return meeting.scheduled_on ?? iso(d);

    case "weekly":
    case "biweekly": {
      const target = meeting.day_of_week ?? 5; // default Friday
      const delta = (target - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + delta);
      return iso(d);
    }

    case "monthly": {
      const target = meeting.day_of_month ?? 1;
      const next = new Date(d.getFullYear(), d.getMonth(), target);
      if (next < d) next.setMonth(next.getMonth() + 1);
      return iso(next);
    }

    case "adhoc":
      return iso(d);
  }
}

/** Step `steps` occurrences forward/backward from `occursOn`. */
export function occurrenceOffset(
  occursOn: string,
  meeting: Pick<Meeting, "cadence">,
  steps: number,
): string {
  const d = new Date(occursOn + "T00:00:00");
  switch (meeting.cadence) {
    case "daily":    d.setDate(d.getDate() + steps); break;
    case "weekly":   d.setDate(d.getDate() + steps * 7); break;
    case "biweekly": d.setDate(d.getDate() + steps * 14); break;
    case "monthly":  d.setMonth(d.getMonth() + steps); break;
    case "adhoc":    d.setDate(d.getDate() + steps * 7); break;
    case "once":     break; // no other occurrence to step to
  }
  return iso(d);
}

/** "Friday, May 15, 2026 @ 7 AM" */
export function formatOccurrence(
  occursOn: string,
  meeting: Pick<Meeting, "start_time">,
): string {
  const d = new Date(occursOn + "T00:00:00");
  const dateStr = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  if (meeting.start_time) return `${dateStr} @ ${formatTime12h(meeting.start_time)}`;
  return dateStr;
}

/** "Every Friday at 7 AM", "Daily at 7 AM", "Monthly on day 1", etc. */
export function formatCadence(
  meeting: Pick<Meeting, "cadence" | "day_of_week" | "day_of_month" | "start_time">,
): string {
  const time = meeting.start_time ? ` at ${formatTime12h(meeting.start_time)}` : "";
  switch (meeting.cadence) {
    case "daily":    return `Daily${time}`;
    case "weekly":   return `Every ${dayName(meeting.day_of_week) || "week"}${time}`;
    case "biweekly": return `Every other ${dayName(meeting.day_of_week) || "week"}${time}`;
    case "monthly":  return `Monthly on day ${meeting.day_of_month ?? 1}${time}`;
    case "adhoc":    return "As needed";
    case "once":     return `One-time${time}`;
  }
}

export function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  if (!Number.isFinite(h)) return time;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${h12} ${ampm}`;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
