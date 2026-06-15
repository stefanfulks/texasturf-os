import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { signFeedbackPaths } from "@/lib/feedback-images";
import { ImageLightbox, type LightboxImage } from "@/components/image-lightbox";
import type { FeedbackAttachment } from "@/lib/db-helpers.types";
import { FeedbackForm } from "./feedback-form";
import { WithdrawButton } from "./withdraw-button";

export const metadata = { title: "Feedback · TexasTurf OS" };

const STATUS_LABEL: Record<string, string> = {
  new:         "New",
  in_progress: "In progress",
  resolved:    "Resolved",
  wont_fix:    "Won't fix",
};
const STATUS_BADGE: Record<string, string> = {
  new:         "bg-info-tint text-info",
  in_progress: "bg-warn-tint text-warn",
  resolved:    "bg-brand-tint text-brand",
  wont_fix:    "bg-sunken text-ink-3",
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
  // at /admin/feedback — separate surface). Withdrawn items are hidden.
  const { data: mine } = await supabase
    .from("app_feedback")
    .select("id, category, subject, body, status, admin_notes, attachments, resolved_at, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const submissions = (mine ?? []) as unknown as Array<{
    id: string; category: string; subject: string; body: string | null;
    status: string; admin_notes: string | null; attachments: FeedbackAttachment[] | null;
    resolved_at: string | null; created_at: string;
  }>;

  // Sign every screenshot path in one storage round-trip.
  const signed = await signFeedbackPaths(
    supabase,
    submissions.flatMap((s) => (s.attachments ?? []).map((a) => a.path)),
  );
  const imagesFor = (atts: FeedbackAttachment[] | null): LightboxImage[] =>
    (atts ?? [])
      .map((a): LightboxImage | null => {
        const url = signed.get(a.path);
        return url ? { url, name: a.name } : null;
      })
      .filter((x): x is LightboxImage => x !== null);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
        <p className="mt-0.5 text-sm text-ink-3">
          Bug? Idea? Question? Drop it here — add a screenshot if it helps — and an admin will follow up.
        </p>
      </div>

      <FeedbackForm userId={user.id} />

      {submissions.length > 0 && (
        <section className="rounded-xl border border-line bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-line">
            <h2 className="text-sm font-semibold">Your past submissions</h2>
          </div>
          <ul className="divide-y divide-line">
            {submissions.map((s) => {
              const images = imagesFor(s.attachments);
              return (
                <li key={s.id} className="px-5 py-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <p className="text-sm font-medium text-ink">{s.subject}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-ink-3">
                        {CATEGORY_LABEL[s.category] ?? s.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[s.status] ?? ""}`}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </div>
                  </div>
                  {s.body && (
                    <p className="text-sm text-ink-2 whitespace-pre-wrap">{s.body}</p>
                  )}
                  {images.length > 0 && (
                    <div className="pt-1">
                      <ImageLightbox images={images} size="sm" />
                    </div>
                  )}
                  {s.admin_notes && (
                    <div className="rounded-md bg-hover border border-line px-3 py-2 text-xs text-ink-2 mt-1.5">
                      <p className="font-medium text-ink-3 mb-0.5">Admin reply</p>
                      {s.admin_notes}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <p className="text-xs text-ink-4">
                      Submitted {format(parseISO(s.created_at), "MMM d, h:mm a")}
                      {s.resolved_at && ` · Resolved ${format(parseISO(s.resolved_at), "MMM d")}`}
                    </p>
                    {s.status === "new" && <WithdrawButton id={s.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

    </div>
  );
}
