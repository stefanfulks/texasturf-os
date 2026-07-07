import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Plus, Calendar as CalendarIcon, Archive, ArchiveRestore } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCadence } from "@/lib/meetings/cadence";
import type { Meeting } from "@/lib/meetings/types";
import { archiveMeeting, unarchiveMeeting } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meetings · Settings · TexasTurf OS" };

export default async function MeetingsSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";

  // RLS keeps non-admins to meetings they can see; admins see everything.
  const meetingsRes = await (
    supabase.from("meetings") as unknown as {
      select: (cols: string) => {
        order: (c: string, opts: { ascending: boolean }) => Promise<{ data: Meeting[] | null; error: { message: string } | null }>;
      };
    }
  )
    .select("id, slug, name, description, cadence, day_of_week, day_of_month, start_time, duration_min, allowed_roles, allowed_departments, sections, archived")
    .order("archived", { ascending: true });

  const meetings = meetingsRes.data ?? [];
  const active = meetings.filter((m) => !m.archived);
  const archived = meetings.filter((m) => m.archived);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-5">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-ink-3 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
        Settings
      </Link>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="text-sm sm:text-base text-ink-2 mt-1">
            {isAdmin
              ? "Create, edit, archive meeting templates. Sections drive what people can file under each one."
              : "Browse what meeting templates exist. Admins can edit them."}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/meetings/new"
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-strong active:bg-brand-strong"
          >
            <Plus className="h-4 w-4" />
            New meeting
          </Link>
        )}
      </div>

      {meetingsRes.error && (
        <div className="rounded-2xl border border-warn/30 bg-warn-tint p-4 text-sm text-warn">
          <p className="font-semibold">Couldn&apos;t load meetings.</p>
          <p className="mt-1 text-xs">{meetingsRes.error.message}</p>
        </div>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2 px-1">Active</h2>
          <ul className="space-y-2">
            {active.map((m) => (
              <MeetingRow key={m.id} meeting={m} isAdmin={isAdmin} archived={false} />
            ))}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-2 px-1">Archived</h2>
          <ul className="space-y-2">
            {archived.map((m) => (
              <MeetingRow key={m.id} meeting={m} isAdmin={isAdmin} archived={true} />
            ))}
          </ul>
        </section>
      )}

      {meetings.length === 0 && !meetingsRes.error && (
        <div className="rounded-2xl border border-line bg-white p-10 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-base font-semibold text-ink">No meeting templates yet</p>
          <p className="text-sm text-ink-3 mt-1">
            {isAdmin ? "Create one to start." : "Ask an admin to set one up for your team."}
          </p>
          {isAdmin && (
            <Link
              href="/meetings/new"
              className="btn btn-primary h-11 px-5 mt-4"
            >
              <Plus className="h-4 w-4" />
              New meeting
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function MeetingRow({
  meeting,
  isAdmin,
  archived,
}: {
  meeting: Meeting;
  isAdmin: boolean;
  archived: boolean;
}) {
  return (
    <li className={"rounded-2xl border border-line bg-white p-4 sm:p-5 " + (archived ? "opacity-60" : "")}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-sunken text-ink-2 flex items-center justify-center">
          <CalendarIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/meetings/${meeting.slug}`}
              className="text-sm sm:text-base font-semibold text-ink hover:underline"
            >
              {meeting.name}
            </Link>
            <span className="text-xs text-ink-3">/{meeting.slug}</span>
            {archived && (
              <span className="rounded-full bg-sunken text-ink-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Archived
              </span>
            )}
          </div>
          {meeting.description && (
            <p className="text-xs text-ink-2 mt-0.5">{meeting.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
            <span className="text-ink-3">{formatCadence(meeting)}</span>
            <span className="text-ink-4">·</span>
            <span className="text-ink-3">{meeting.sections.length} section{meeting.sections.length === 1 ? "" : "s"}</span>
            {meeting.allowed_roles.length > 0 && (
              <>
                <span className="text-ink-4">·</span>
                <span className="rounded-full bg-sunken text-ink-2 px-2 py-0.5 font-medium capitalize">
                  {meeting.allowed_roles.join(", ")}
                </span>
              </>
            )}
            {meeting.allowed_departments.length > 0 && (
              <>
                <span className="text-ink-4">·</span>
                <span className="rounded-full bg-info-tint text-info px-2 py-0.5 font-medium capitalize">
                  {meeting.allowed_departments.join(", ")}
                </span>
              </>
            )}
            {meeting.allowed_roles.length === 0 && meeting.allowed_departments.length === 0 && (
              <>
                <span className="text-ink-4">·</span>
                <span className="rounded-full bg-brand-tint text-brand px-2 py-0.5 font-medium">
                  Everyone
                </span>
              </>
            )}
          </div>
        </div>
        {isAdmin && (
          <form
            action={archived ? unarchiveMeeting : archiveMeeting}
            className="flex-shrink-0"
          >
            <input type="hidden" name="id" value={meeting.id} />
            <button
              type="submit"
              title={archived ? "Restore" : "Archive"}
              aria-label={archived ? "Restore meeting" : "Archive meeting"}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink-3 hover:text-ink hover:bg-sunken"
            >
              {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
