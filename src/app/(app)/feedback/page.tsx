import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "./feedback-form";

export const metadata = { title: "Feedback · TexasTurf OS" };

const STATUS_LABEL: Record<string, string> = {
  new:         "New",
  in_progress: "In progress",
  resolved:    "Resolved",
  wont_fix:    "Won't fix",
};
const STATUS_BADGE: Record<string, string> = {
  new:         "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved:    "bg-green-100 text-green-700",
  wont_fix:    "bg-zinc-100 text-zinc-500",
};
const CATEGORY_LABEL: Record<string, string> = {
  bug:             "Bug",
  feature_request: "Feature",
  question:        "Question",
  other:           "Other",
};

export default async function FeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Show this user's own past submissions (admin gets the full triage view
  // at /team — separate surface).
  const { data: mine } = await supabase
    .from("app_feedback")
    .select("id, category, subject, body, status, admin_notes, resolved_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const submissions = (mine ?? []) as Array<{
    id: string; category: string; subject: string; body: string | null;
    status: string; admin_notes: string | null; resolved_at: string | null; created_at: string;
  }>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Bug? Idea? Question? Drop it here and an admin will follow up.
        </p>
      </div>

      <FeedbackForm />

      {submissions.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100">
            <h2 className="text-sm font-semibold">Your past submissions</h2>
          </div>
          <ul className="divide-y divide-zinc-100">
            {submissions.map((s) => (
              <li key={s.id} className="px-5 py-4 space-y-1.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-sm font-medium text-zinc-900">{s.subject}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-zinc-500">
                      {CATEGORY_LABEL[s.category] ?? s.category}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[s.status] ?? ""}`}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </div>
                </div>
                {s.body && (
                  <p className="text-sm text-zinc-600 whitespace-pre-wrap">{s.body}</p>
                )}
                {s.admin_notes && (
                  <div className="rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-700 mt-1.5">
                    <p className="font-medium text-zinc-500 mb-0.5">Admin reply</p>
                    {s.admin_notes}
                  </div>
                )}
                <p className="text-xs text-zinc-400">
                  Submitted {format(parseISO(s.created_at), "MMM d, h:mm a")}
                  {s.resolved_at && ` · Resolved ${format(parseISO(s.resolved_at), "MMM d")}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-zinc-400">
        Admin? See all incoming feedback at{" "}
        <Link href="/admin/feedback" className="underline hover:text-zinc-700">
          /admin/feedback
        </Link>
        .
      </p>
    </div>
  );
}
