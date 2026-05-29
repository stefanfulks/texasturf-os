import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listUpcomingEvents, type GoogleCalendarEvent } from "@/lib/google/calendar";

export const dynamic = "force-dynamic";

function formatEventTime(event: GoogleCalendarEvent): string {
  const start = event.start.dateTime ?? event.start.date;
  const end = event.end.dateTime ?? event.end.date;
  if (!start) return "";

  if (event.start.date && !event.start.dateTime) {
    // All-day event
    const d = new Date(start);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · All day";
  }

  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const dateStr = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const startTime = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (!e) return `${dateStr} · ${startTime}`;
  const endTime = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

function groupEventsByDay(events: GoogleCalendarEvent[]): Map<string, GoogleCalendarEvent[]> {
  const groups = new Map<string, GoogleCalendarEvent[]>();
  for (const event of events) {
    const start = event.start.dateTime ?? event.start.date;
    if (!start) continue;
    const day = new Date(start).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(event);
  }
  return groups;
}

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const providerToken = session?.provider_token;
  const isGoogleUser = session?.user?.app_metadata?.provider === "google";

  const embedSrc = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_SRC;

  // Try to fetch the user's events if they signed in with Google
  let events: GoogleCalendarEvent[] = [];
  let fetchError: string | null = null;
  if (isGoogleUser && providerToken) {
    try {
      const sevenDaysOut = new Date();
      sevenDaysOut.setDate(sevenDaysOut.getDate() + 14);
      events = await listUpcomingEvents(providerToken, { maxResults: 50, timeMax: sevenDaysOut });
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    }
  }

  const groupedEvents = groupEventsByDay(events);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Calendar</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {isGoogleUser
              ? "Your personal Google Calendar, plus the shared TexasTurf calendar."
              : "Sign in with Google to see your personal calendar."}
          </p>
        </div>
        <Link
          href="/calendar/new"
          className="bg-zinc-900 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-zinc-800 transition-colors"
        >
          New event
        </Link>
      </div>

      {/* Personal agenda (Google API) */}
      {isGoogleUser ? (
        <section>
          <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            Your next 2 weeks
          </p>
          {fetchError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Couldn&apos;t load Google Calendar events: {fetchError}.
              Try signing out and back in with Google.
            </div>
          ) : groupedEvents.size === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">
              No upcoming events in the next 2 weeks.
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(groupedEvents.entries()).map(([day, dayEvents]) => (
                <div key={day} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                  <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-100">
                    <p className="font-semibold text-zinc-900 text-sm">{day}</p>
                  </div>
                  <ul className="divide-y divide-zinc-100">
                    {dayEvents.map((event) => (
                      <li key={event.id} className="px-4 py-3 hover:bg-zinc-50/50">
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <p className="font-medium text-zinc-900 text-sm">
                            {event.summary || "(no title)"}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {formatEventTime(event)}
                            {event.location && <span> · {event.location}</span>}
                          </p>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-700">
            <strong className="text-zinc-900">Connect your Google account</strong> to see your personal calendar inline.
            Sign out and sign back in using the &quot;Continue with Google&quot; button.
          </p>
          <Link
            href="/login"
            className="mt-3 inline-block text-sm font-medium text-zinc-900 underline"
          >
            Go to sign-in →
          </Link>
        </div>
      )}

      {/* Shared TexasTurf calendar embed */}
      {embedSrc ? (
        <section>
          <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            Shared TexasTurf calendar
          </p>
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <iframe
              src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(embedSrc)}&ctz=America%2FChicago&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0`}
              className="w-full"
              style={{ height: 600, border: 0 }}
              title="TexasTurf Calendar"
            />
          </div>
        </section>
      ) : (
        <section>
          <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            Shared TexasTurf calendar
          </p>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Set <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_SRC</code> in
            Vercel to the Google Calendar ID (e.g. <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-xs">team@texasturfusa.com</code>) to embed
            the shared calendar here. Make sure the calendar is set to
            &quot;Make available for TexasTurf&quot; or fully public.
          </div>
        </section>
      )}
    </div>
  );
}
