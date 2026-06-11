// Google Calendar glue for meetings: when an admin creates a meeting with a
// start time, we create a matching Calendar event (recurring per the cadence)
// with a Google Meet conference, invite everyone the meeting is scoped to,
// and store the Meet link on the meetings row.
//
// Failure here must NEVER block meeting creation — callers treat the result
// as best-effort and the UI offers a manual paste fallback.

import { getValidGoogleAccessToken } from "@/lib/google/tokens";
import { createEvent, meetUrlOf } from "@/lib/google/calendar";
import { upcomingOccurrence } from "@/lib/meetings/cadence";
import type { Meeting } from "@/lib/meetings/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://os.texasturfusa.com";

const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

type SchedulableMeeting = Pick<
  Meeting,
  | "id" | "slug" | "name" | "description" | "cadence" | "day_of_week"
  | "day_of_month" | "scheduled_on" | "start_time" | "duration_min"
  | "allowed_roles" | "allowed_departments" | "invited_user_ids"
>;

export function cadenceToRRule(m: SchedulableMeeting): string[] | undefined {
  switch (m.cadence) {
    case "daily":
      return ["RRULE:FREQ=DAILY"];
    case "weekly":
      return [`RRULE:FREQ=WEEKLY;BYDAY=${RRULE_DAYS[m.day_of_week ?? 5]}`];
    case "biweekly":
      return [`RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${RRULE_DAYS[m.day_of_week ?? 5]}`];
    case "monthly":
      return [`RRULE:FREQ=MONTHLY;BYMONTHDAY=${m.day_of_month ?? 1}`];
    case "once":
    case "adhoc":
      return undefined;
  }
}

/** Wall-clock start/end strings for the first occurrence ("2026-06-12T07:00:00").
 *  Returned without a zone suffix — createEvent pins America/Chicago. */
function firstOccurrenceWindow(m: SchedulableMeeting): { start: string; end: string } | null {
  if (!m.start_time) return null;
  const date = m.cadence === "once" ? m.scheduled_on : upcomingOccurrence(m);
  if (!date) return null;
  const hhmm = m.start_time.slice(0, 5);
  // Date math only — the fixed-UTC parse keeps wall-clock arithmetic stable
  // regardless of server timezone.
  const start = new Date(`${date}T${hhmm}:00Z`);
  const end = new Date(start.getTime() + (m.duration_min ?? 60) * 60_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 19);
  return { start: fmt(start), end: fmt(end) };
}

type ProfileRow = {
  id: string;
  email: string;
  role: string | null;
  departments: string[] | null;
};

/** Everyone the meeting is scoped to: direct invitees + role matches +
 *  department matches. Open-to-everyone meetings invite no one beyond the
 *  organizer — we don't blast the whole company onto a calendar event. */
export function resolveAttendeeEmails(
  m: SchedulableMeeting,
  profiles: ProfileRow[],
  creatorId: string,
): string[] {
  const emails = new Set<string>();
  for (const p of profiles) {
    if (p.id === creatorId) continue; // organizer is on the event already
    const invited = m.invited_user_ids.includes(p.id);
    const roleMatch = p.role != null && m.allowed_roles.includes(p.role);
    const deptMatch =
      m.allowed_departments.length > 0 &&
      (p.departments ?? []).some((d) => m.allowed_departments.includes(d));
    if (invited || roleMatch || deptMatch) emails.add(p.email);
  }
  return [...emails];
}

export type ScheduleResult =
  | { ok: true; meetUrl: string | null; eventId: string }
  | { ok: false; reason: string };

/** Create the Calendar event + Meet link for a meeting, best-effort. */
export async function scheduleMeetingOnGoogle(
  m: SchedulableMeeting,
  profiles: ProfileRow[],
  creatorId: string,
): Promise<ScheduleResult> {
  // Ad-hoc meetings have no fixed time — nothing to put on a calendar.
  if (m.cadence === "adhoc") return { ok: false, reason: "adhoc meetings have no scheduled time" };

  const window = firstOccurrenceWindow(m);
  if (!window) return { ok: false, reason: "no start time set" };

  const token = await getValidGoogleAccessToken(creatorId);
  if (!token.ok) return { ok: false, reason: `Google not connected (${token.reason})` };

  try {
    const event = await createEvent(token.accessToken, {
      summary: m.name,
      description: [m.description, `Agenda & filing: ${APP_URL}/meetings/${m.slug}`]
        .filter(Boolean)
        .join("\n\n"),
      start: window.start,
      end: window.end,
      attendees: resolveAttendeeEmails(m, profiles, creatorId),
      recurrence: cadenceToRRule(m),
      withMeet: true,
    });
    return { ok: true, meetUrl: meetUrlOf(event), eventId: event.id };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "calendar request failed" };
  }
}
