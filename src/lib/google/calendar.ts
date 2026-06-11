/**
 * Google Calendar API helpers — uses the user's Google OAuth access
 * token (issued by Supabase Auth when they signed in with Google).
 *
 * Token is stored as session.provider_token. Supabase auto-refreshes
 * provider tokens when `access_type=offline` is set on sign-in.
 */

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  organizer?: { email?: string; displayName?: string };
  status?: string;
  /** Present when the event has a Google Meet conference attached. */
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string }>;
  };
};

type CalendarApiError = { error: { code: number; message: string } };

const BASE = "https://www.googleapis.com/calendar/v3";

async function gcalFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!resp.ok) {
    let detail = "";
    try {
      const j = (await resp.json()) as CalendarApiError;
      detail = j.error?.message ?? "";
    } catch {
      detail = await resp.text();
    }
    throw new Error(`Google Calendar API ${resp.status}: ${detail}`);
  }
  return resp.json() as Promise<T>;
}

export async function listUpcomingEvents(
  accessToken: string,
  options: { maxResults?: number; calendarId?: string; timeMin?: Date; timeMax?: Date } = {},
): Promise<GoogleCalendarEvent[]> {
  const calendarId = options.calendarId ?? "primary";
  const maxResults = options.maxResults ?? 25;
  const timeMin = (options.timeMin ?? new Date()).toISOString();
  const timeMax = options.timeMax?.toISOString();

  const params = new URLSearchParams({
    timeMin,
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
  });
  if (timeMax) params.set("timeMax", timeMax);

  const data = await gcalFetch<{ items: GoogleCalendarEvent[] }>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );

  return data.items ?? [];
}

export async function createEvent(
  accessToken: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: string;     // ISO 8601 datetime
    end: string;       // ISO 8601 datetime
    attendees?: string[];
    calendarId?: string;
    /** Attach a Google Meet conference to the event. */
    withMeet?: boolean;
    /** RRULE lines, e.g. ["RRULE:FREQ=WEEKLY;BYDAY=FR"]. */
    recurrence?: string[];
  },
): Promise<GoogleCalendarEvent> {
  const calendarId = event.calendarId ?? "primary";
  // conferenceDataVersion=1 is required or the API silently drops the
  // conferenceData.createRequest.
  const query = event.withMeet ? "?conferenceDataVersion=1" : "";
  return gcalFetch<GoogleCalendarEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events${query}`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start, timeZone: "America/Chicago" },
        end: { dateTime: event.end, timeZone: "America/Chicago" },
        attendees: event.attendees?.map((email) => ({ email })),
        recurrence: event.recurrence,
        ...(event.withMeet
          ? {
              conferenceData: {
                createRequest: {
                  requestId: crypto.randomUUID(),
                  // The API field is `type` (not `key`) — sending anything
                  // else fails with 400 "Invalid conference data".
                  conferenceSolutionKey: { type: "hangoutsMeet" },
                },
              },
            }
          : {}),
      }),
    },
  );
}

/** The Meet URL of an event, however Google chose to report it. */
export function meetUrlOf(event: GoogleCalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const video = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  return video?.uri ?? null;
}

export async function deleteEvent(
  accessToken: string,
  eventId: string,
  calendarId = "primary",
): Promise<void> {
  await gcalFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
}
