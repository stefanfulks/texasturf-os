import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Briefcase, Users, CheckSquare, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyTaskIds } from "@/lib/tasks/scope";
import { upcomingOccurrence } from "@/lib/meetings/cadence";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { getValidGoogleAccessToken } from "@/lib/google/tokens";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda · TexasTurf OS" };

const WINDOW_DAYS = 7;

type Kind = "visit" | "meeting" | "task" | "google";

type AgendaItem = {
  dayKey: string;        // YYYY-MM-DD (UTC, matching the rest of the app)
  sortAt: number;        // epoch ms — order within a day
  time: string | null;   // display time, or null for all-day items
  kind: Kind;
  title: string;
  subtitle: string | null;
  href: string | null;
  external?: boolean;
};

const KIND_META: Record<Kind, { label: string; dot: string; icon: typeof Briefcase }> = {
  visit:   { label: "Visit",   dot: "bg-brand", icon: Briefcase },
  meeting: { label: "Meeting", dot: "bg-info",  icon: Users },
  task:    { label: "Task",    dot: "bg-warn",  icon: CheckSquare },
  google:  { label: "Event",   dot: "bg-ink-3", icon: CalendarDays },
};

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function dayLabel(key: string, todayKey: string): { weekday: string; date: string; isToday: boolean } {
  const d = new Date(`${key}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    isToday: key === todayKey,
  };
}

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + WINDOW_DAYS);
  const startKey = utcDayKey(windowStart);
  const endKeyExclusive = utcDayKey(windowEnd);

  const dayKeys: string[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(windowStart);
    d.setUTCDate(d.getUTCDate() + i);
    dayKeys.push(utcDayKey(d));
  }

  const items: AgendaItem[] = [];

  // ── 1) Jobber visits ────────────────────────────────────────────────────
  const { data: visits } = await supabase
    .from("jobber_visits")
    .select("id, title, starts_at, is_complete")
    .gte("starts_at", windowStart.toISOString())
    .lt("starts_at", windowEnd.toISOString())
    .order("starts_at", { ascending: true })
    .limit(100);
  for (const v of visits ?? []) {
    if (!v.starts_at) continue;
    const at = new Date(v.starts_at);
    items.push({
      dayKey: utcDayKey(at),
      sortAt: at.getTime(),
      time: fmtTime(at),
      kind: "visit",
      title: v.title ?? "Jobber visit",
      subtitle: v.is_complete ? "Complete" : null,
      href: "/today",
    });
  }

  // ── 2) Meeting occurrences ──────────────────────────────────────────────
  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, name, slug, cadence, day_of_week, day_of_month, scheduled_on, start_time")
    .eq("archived", false);
  for (const m of meetings ?? []) {
    if (m.cadence === "adhoc") continue;
    for (const key of dayKeys) {
      const d = new Date(`${key}T00:00:00Z`);
      if (upcomingOccurrence(m, d) !== key) continue;
      let time: string | null = null;
      let sortAt = new Date(`${key}T00:00:00Z`).getTime();
      if (m.start_time) {
        const dt = new Date(`${key}T${m.start_time}Z`);
        if (!Number.isNaN(dt.getTime())) {
          time = fmtTime(dt);
          sortAt = dt.getTime();
        }
      }
      items.push({
        dayKey: key,
        sortAt,
        time,
        kind: "meeting",
        title: m.name,
        subtitle: null,
        href: m.slug ? `/meetings/${m.slug}` : "/meetings",
      });
    }
  }

  // ── 3) Tasks due (mine) ─────────────────────────────────────────────────
  const myIds = await getMyTaskIds(supabase, user.id);
  if (myIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, priority, status")
      .in("id", myIds)
      .not("status", "in", "(done,archived)")
      .gte("due_date", startKey)
      .lt("due_date", endKeyExclusive);
    for (const t of tasks ?? []) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      items.push({
        dayKey: key,
        sortAt: new Date(`${key}T00:00:00Z`).getTime() - 1, // all-day → top of day
        time: null,
        kind: "task",
        title: t.title,
        subtitle: t.priority && t.priority !== "normal" ? `${t.priority} priority` : null,
        href: `/tasks/${t.id}`,
      });
    }
  }

  // ── 4) Google Calendar events ───────────────────────────────────────────
  let googleConnected = false;
  let googleError: string | null = null;
  const tokenStatus = await getValidGoogleAccessToken(user.id);
  if (tokenStatus.ok) {
    googleConnected = true;
    try {
      const events = await listUpcomingEvents(tokenStatus.accessToken, {
        timeMin: now,
        timeMax: windowEnd,
        maxResults: 50,
      });
      for (const e of events) {
        const startRaw = e.start.dateTime ?? e.start.date;
        if (!startRaw) continue;
        const allDay = !e.start.dateTime;
        const at = new Date(startRaw);
        const key = allDay ? startRaw.slice(0, 10) : utcDayKey(at);
        if (key < startKey || key >= endKeyExclusive) continue;
        items.push({
          dayKey: key,
          sortAt: allDay ? new Date(`${key}T00:00:00Z`).getTime() : at.getTime(),
          time: allDay ? null : fmtTime(at),
          kind: "google",
          title: e.summary || "(no title)",
          subtitle: e.location ?? null,
          href: e.htmlLink,
          external: true,
        });
      }
    } catch (err) {
      googleError = err instanceof Error ? err.message : String(err);
    }
  }

  items.sort((a, b) => a.sortAt - b.sortAt);
  const byDay = new Map<string, AgendaItem[]>();
  for (const key of dayKeys) byDay.set(key, []);
  for (const it of items) byDay.get(it.dayKey)?.push(it);

  const todayKey = startKey;
  const totalItems = items.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Next 7 days</p>
          <h1 className="display mt-2 text-[2rem] leading-[1.05] text-ink">Agenda</h1>
          <p className="mt-2 text-sm text-ink-3">
            Visits, meetings, tasks{googleConnected ? ", and your calendar" : ""} — one timeline.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-3">
          <Link href="/calendar" className="hover:text-brand transition-colors">Calendar →</Link>
          <Link href="/meetings" className="hover:text-brand transition-colors">Meetings →</Link>
        </div>
      </div>

      {!googleConnected && (
        <div className="rounded-xl border border-dashed border-line-strong bg-hover px-4 py-3 text-xs text-ink-3">
          Connect Google on the <Link href="/calendar" className="underline">Calendar</Link> page to fold your personal events into this view.
        </div>
      )}
      {googleError && (
        <div className="rounded-xl border border-warn-line bg-warn-tint px-4 py-3 text-xs text-warn">
          Couldn&apos;t load Google events: {googleError}
        </div>
      )}

      {totalItems === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-16 text-center">
          <p className="text-sm font-medium text-ink-2">Nothing scheduled.</p>
          <p className="mt-1 text-xs text-ink-4">The next week is clear across visits, meetings, and your tasks.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {dayKeys.map((key) => {
            const dayItems = byDay.get(key) ?? [];
            if (dayItems.length === 0) return null;
            const { weekday, date, isToday } = dayLabel(key, todayKey);
            return (
              <section key={key} className="reveal">
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 className="text-sm font-semibold text-ink">{isToday ? "Today" : weekday}</h2>
                  <span className="text-xs text-ink-4">{date}</span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <ul className="divide-y divide-line">
                    {dayItems.map((it, idx) => {
                      const meta = KIND_META[it.kind];
                      const Icon = meta.icon;
                      const inner = (
                        <div className="flex items-center gap-3 px-4 py-3">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                          <span className="w-16 shrink-0 text-xs tabular-nums text-ink-4">
                            {it.time ?? "All day"}
                          </span>
                          <Icon className="h-4 w-4 shrink-0 text-ink-3" />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">{it.title}</span>
                          {it.subtitle && (
                            <span className="hidden shrink-0 text-xs capitalize text-ink-4 sm:inline">{it.subtitle}</span>
                          )}
                          {it.external && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-4" />}
                        </div>
                      );
                      if (!it.href) return <li key={idx}>{inner}</li>;
                      return it.external ? (
                        <li key={idx}>
                          <a href={it.href} target="_blank" rel="noopener noreferrer" className="block hover:bg-hover transition-colors">{inner}</a>
                        </li>
                      ) : (
                        <li key={idx}>
                          <Link href={it.href} className="block hover:bg-hover transition-colors">{inner}</Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
