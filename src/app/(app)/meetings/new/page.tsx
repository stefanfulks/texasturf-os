import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MeetingForm } from "./meeting-form";

export const metadata = { title: "New Meeting · TexasTurf OS" };

export default async function NewMeetingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, profilesRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("profiles").select("id, full_name, email").order("full_name", { ascending: true }),
  ]);
  const isAdmin = (profile as { role?: string } | null)?.role === "admin";
  const profiles = (profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string }>;
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-ink-3 hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
          Meetings
        </Link>
        <div className="rounded-2xl border border-warn/30 bg-warn-tint p-4 text-sm text-warn">
          Only admins can create meetings.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-5 pb-12">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-ink-3 hover:text-ink active:text-ink-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Meetings
      </Link>
      <div>
        <h1 className="page-title">New Meeting</h1>
        <p className="text-sm sm:text-base text-ink-2 mt-1">
          Define cadence, who can see it, and the agenda sections people will file items under.
        </p>
      </div>
      <MeetingForm profiles={profiles} />
    </div>
  );
}
