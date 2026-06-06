import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  upcomingOccurrence,
  occurrenceOffset,
  formatOccurrence,
  formatCadence,
} from "@/lib/meetings/cadence";
import { ACCENT_CLASSES, type Meeting, type MeetingItem, type MeetingSection, type SectionAccent } from "@/lib/meetings/types";
import { NewItemFab } from "./new-item-fab";
import { AgendaActions } from "./agenda-actions";
import { ItemRow } from "./item-row";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ date?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `${slug} · Meetings · TexasTurf OS` };
}

export default async function MeetingDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = (await searchParams) ?? {};

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Find the meeting by slug. RLS filters by access.
  const meetingRes = await (
    supabase.from("meetings") as unknown as {
      select: (cols: string) => {
        eq: (c: string, v: string) => {
          single: () => Promise<{ data: Meeting | null; error: { message: string } | null }>;
        };
      };
    }
  )
    .select("id, slug, name, description, cadence, day_of_week, day_of_month, start_time, duration_min, allowed_roles, allowed_departments, sections, archived")
    .eq("slug", slug)
    .single();

  if (meetingRes.error || !meetingRes.data) notFound();
  const meeting = meetingRes.data;

  const occursOn = search.date ?? upcomingOccurrence(meeting);
  const prevOn = occurrenceOffset(occursOn, meeting, -1);
  const nextOn = occurrenceOffset(occursOn, meeting, +1);

  const [itemsRes, profilesRes] = await Promise.all([
    (supabase.from("meeting_items") as unknown as {
      select: (cols: string) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => {
            order: (c: string, opts: { ascending: boolean }) => Promise<{ data: MeetingItem[] | null }>;
          };
        };
      };
    })
      .select("id, meeting_id, occurs_on, section_key, title, body, status, owner_id, due_date, author_id, created_at")
      .eq("meeting_id", meeting.id)
      .eq("occurs_on", occursOn)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email").order("full_name", { ascending: true }),
  ]);

  const items = itemsRes.data ?? [];
  const profiles = (profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string }>;
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // Bucket items per section.
  const bySection: Record<string, MeetingItem[]> = {};
  for (const s of meeting.sections) bySection[s.key] = [];
  for (const item of items) {
    (bySection[item.section_key] ??= []).push(item);
  }

  const openCount = items.filter((i) => i.status === "pending" || i.status === "carried_over").length;
  const doneCount = items.filter((i) => i.status === "done" || i.status === "discussed").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-5 pb-32 sm:pb-6">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-zinc-500 hover:text-zinc-900 active:text-zinc-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Meetings
      </Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">{meeting.name}</h1>
        {meeting.description && (
          <p className="text-sm sm:text-base text-zinc-600 mt-1">{meeting.description}</p>
        )}
        <p className="text-xs text-zinc-500 mt-1">{formatCadence(meeting)}</p>
      </div>

      {/* Occurrence navigation */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
        <Link
          href={`/meetings/${meeting.slug}?date=${prevOn}`}
          className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200"
          aria-label="Previous occurrence"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Meeting</p>
          <p className="text-sm sm:text-base font-semibold text-zinc-900 truncate">
            {formatOccurrence(occursOn, meeting)}
          </p>
          <p className="text-[11px] text-zinc-500 tabular-nums">
            {openCount} open · {doneCount} done · {items.length} total
          </p>
        </div>
        <Link
          href={`/meetings/${meeting.slug}?date=${nextOn}`}
          className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200"
          aria-label="Next occurrence"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {/* Top actions */}
      <AgendaActions
        meeting={meeting}
        occursOn={occursOn}
        items={items.map((i) => ({
          id: i.id,
          section_key: i.section_key,
          title: i.title,
          body: i.body,
          status: i.status,
          authorName: profileById.get(i.author_id)?.full_name ?? profileById.get(i.author_id)?.email?.split("@")[0] ?? "",
          ownerName: i.owner_id ? (profileById.get(i.owner_id)?.full_name ?? profileById.get(i.owner_id)?.email?.split("@")[0] ?? null) : null,
          dueDate: i.due_date,
        }))}
        openCount={openCount}
      />

      {/* Agenda — one card per section, in the order defined on the meeting */}
      <div className="space-y-3">
        {meeting.sections.map((section, idx) => {
          const sectionItems = bySection[section.key] ?? [];
          const accent = (section.accent ?? "zinc") as SectionAccent;
          return (
            <section key={section.key} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
              <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-100 bg-zinc-50/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl leading-none">{section.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">
                      <span className="text-zinc-400 mr-1.5 tabular-nums">{idx + 1}.</span>
                      {section.label}
                    </p>
                    {(section.time_min || section.owner) && (
                      <p className="text-[11px] text-zinc-500">
                        {section.time_min ? `${section.time_min} min` : ""}
                        {section.time_min && section.owner ? " · " : ""}
                        {section.owner ?? ""}
                      </p>
                    )}
                  </div>
                </div>
                <NewItemFab
                  meeting={meeting}
                  occursOn={occursOn}
                  profiles={profiles}
                  defaultSectionKey={section.key}
                  inline
                />
              </header>

              {sectionItems.length === 0 ? (
                <p className="px-5 py-6 text-sm text-zinc-400 italic">
                  No items filed yet for this section.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {sectionItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      section={section as MeetingSection}
                      author={profileById.get(item.author_id) ?? null}
                      owner={item.owner_id ? profileById.get(item.owner_id) ?? null : null}
                      currentUserId={user.id}
                      accentClass={ACCENT_CLASSES[accent]}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* Mobile FAB */}
      <NewItemFab meeting={meeting} occursOn={occursOn} profiles={profiles} />
    </div>
  );
}
