import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { TriageRow } from "./triage-row";

export const metadata = { title: "Feedback Triage · TexasTurf OS" };

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: feedbackRaw } = await supabase
    .from("app_feedback")
    .select("*, user:user_id(id, full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  const feedback = (feedbackRaw ?? []) as unknown as Array<{
    id: string;
    category: string;
    subject: string;
    body: string | null;
    status: string;
    admin_notes: string | null;
    page_url: string | null;
    resolved_at: string | null;
    created_at: string;
    user: { id: string; full_name: string | null; email: string } | null;
  }>;

  const open  = feedback.filter((f) => f.status === "new" || f.status === "in_progress");
  const done  = feedback.filter((f) => f.status === "resolved" || f.status === "wont_fix");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
            <p className="mt-0.5 text-sm text-ink-3">
              Bugs, feature requests, and questions from the team. Triage
              by setting a status and (optionally) replying with admin
              notes — submitters see your reply on their feedback page.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/feedback"
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-2 hover:border-line-strong transition-colors"
            >
              Submit your own →
            </Link>
            <span className="rounded-full bg-info-tint px-3 py-1 text-xs font-semibold text-info">
              {open.length} open
            </span>
            <span className="rounded-full bg-sunken px-3 py-1 text-xs font-semibold text-ink-3">
              {done.length} closed
            </span>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-3">Open</h2>
        {open.length === 0 ? (
          <div className="rounded-xl border border-line bg-white px-5 py-10 text-center text-sm text-ink-4">
            Inbox zero. No open feedback right now.
          </div>
        ) : (
          <ul className="space-y-3">
            {open.map((f) => <TriageRow key={f.id} item={f} />)}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-3">Closed</h2>
          <ul className="space-y-3">
            {done.map((f) => <TriageRow key={f.id} item={f} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

// Re-export STATUS_BADGE used by the triage component
export const FEEDBACK_STATUS_BADGE: Record<string, string> = {
  new:         "bg-info-tint text-info",
  in_progress: "bg-warn-tint text-warn",
  resolved:    "bg-brand-tint text-brand",
  wont_fix:    "bg-sunken text-ink-3",
};

// Util for the row component (mirrored there but exported here for tests)
export function fmtDateTime(iso: string): string {
  return format(parseISO(iso), "MMM d, h:mm a");
}
