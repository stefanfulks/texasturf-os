import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Calendar, ChevronRight, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { upcomingOccurrence, formatCadence, formatOccurrence } from "@/lib/meetings/cadence";
import type { Meeting } from "@/lib/meetings/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meetings · TexasTurf OS" };

export default async function MeetingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS handles role/department access — we just fetch and trust the filter.
  // meetings table not in generated types yet — cast through unknown.
  const meetingsRes = await (
    supabase.from("meetings") as unknown as {
      select: (cols: string) => {
        eq: (c: string, v: boolean) => {
          order: (c: string, opts: { ascending: boolean }) => Promise<{ data: Meeting[] | null; error: { message: string } | null }>;
        };
      };
    }
  )
    .select("id, slug, name, description, cadence, day_of_week, day_of_month, scheduled_on, start_time, duration_min, allowed_roles, allowed_departments, invited_user_ids, meet_url, gcal_event_id, sections, archived")
    .eq("archived", false)
    .order("name", { ascending: true });

  const meetings = meetingsRes.data ?? [];

  // Profile to know if user is admin (for "+ New meeting").
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = (profile as { role?: string } | null)?.role === "admin";

  // For each meeting, fetch open item count for its upcoming occurrence.
  type ItemRow = { meeting_id: string };
  const itemCounts: Record<string, number> = {};
  if (meetings.length > 0) {
    const occurrences = meetings.map((m) => ({ id: m.id, occursOn: upcomingOccurrence(m) }));
    const meetingIds = occurrences.map((o) => o.id);
    const itemsRes = await (
      supabase.from("meeting_items") as unknown as {
        select: (cols: string) => {
          in: (c: string, v: string[]) => {
            in: (c: string, v: string[]) => Promise<{ data: Array<ItemRow & { occurs_on: string }> | null }>;
          };
        };
      }
    )
      .select("meeting_id, occurs_on")
      .in("meeting_id", meetingIds)
      .in("status", ["pending", "carried_over"]);

    const byOccurrence = new Map(occurrences.map((o) => [o.id, o.occursOn]));
    for (const row of itemsRes.data ?? []) {
      if (byOccurrence.get(row.meeting_id) === row.occurs_on) {
        itemCounts[row.meeting_id] = (itemCounts[row.meeting_id] ?? 0) + 1;
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-5 pb-12">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">Meetings</h1>
          <p className="text-sm sm:text-base text-ink-2 mt-1">
            File items into your team&apos;s meetings — they show up in the agenda when it&apos;s time to run it.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/meetings/new"
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-ink text-white text-sm font-semibold hover:bg-ink active:bg-ink"
          >
            <Plus className="h-4 w-4" />
            New meeting
          </Link>
        )}
      </div>

      {meetingsRes.error && (
        <div className="rounded-2xl border border-warn/30 bg-warn-tint p-4 text-sm text-warn">
          <p className="font-semibold">No meetings table yet.</p>
          <p className="mt-1">
            Apply migration{" "}
            <code className="font-mono text-xs">20260605200000_meetings.sql</code> and reload.
          </p>
          <p className="mt-2 text-xs opacity-75">Details: {meetingsRes.error.message}</p>
        </div>
      )}

      {!meetingsRes.error && meetings.length === 0 && (
        <div className="rounded-2xl border border-line bg-white p-10 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-base font-semibold text-ink">No meetings yet</p>
          <p className="text-sm text-ink-3 mt-1">
            {isAdmin ? "Create the first meeting to start filing items." : "Ask an admin to set up a meeting for your team."}
          </p>
          {isAdmin && (
            <Link
              href="/meetings/new"
              className="inline-flex items-center gap-1.5 mt-4 h-11 px-5 rounded-xl bg-ink text-white text-sm font-semibold hover:bg-ink active:bg-ink"
            >
              <Plus className="h-4 w-4" />
              New meeting
            </Link>
          )}
        </div>
      )}

      <div className="space-y-3">
        {meetings.map((m) => {
          const next = upcomingOccurrence(m);
          const openCount = itemCounts[m.id] ?? 0;
          return (
            <Link
              key={m.id}
              href={`/meetings/${m.slug}`}
              className="block rounded-2xl border border-line bg-white p-4 sm:p-5 hover:border-line-strong hover:shadow-sm transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-sunken text-ink-2 flex items-center justify-center">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold text-ink group-hover:underline">{m.name}</p>
                    {m.meet_url && (
                      <span title="Has a Google Meet link" className="inline-flex">
                        <Video className="h-3.5 w-3.5 text-brand" />
                      </span>
                    )}
                    {openCount > 0 && (
                      <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warn">
                        {openCount} open
                      </span>
                    )}
                  </div>
                  {m.description && (
                    <p className="text-sm text-ink-2 mt-0.5 line-clamp-1">{m.description}</p>
                  )}
                  <p className="text-xs text-ink-3 mt-1">
                    {formatCadence(m)} · Next: {formatOccurrence(next, m)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-4 shrink-0 mt-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
