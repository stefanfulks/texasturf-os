import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { PipelineBoard } from "./pipeline-board";
import { LibraryList } from "./library-list";
import { AddContentForm } from "./add-content-form";
import { QuickCapture } from "./quick-capture";

const SERVICE_LINES = [
  "turf", "xeriscape", "lot_clearing", "pavers", "tree_removal", "excavation",
  "stone_work", "site_prep", "concrete", "courts", "fencing", "welding", "landscape_design",
];

export type ContentRow = Database["public"]["Tables"]["content_items"]["Row"];
export type ContentWithUrl = ContentRow & { signed_url: string | null };

const PIPELINE_STATUSES = ["idea", "scripted", "scheduled_shoot", "filmed", "editing", "ready", "published"] as const;

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; service?: string }>;
}) {
  const { tab, type, service } = await searchParams;
  const view = tab === "library" ? "library" : "pipeline";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("content_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
        <div className="rounded-xl border border-warn/30 bg-warn-tint p-6 text-sm text-warn">
          Content tables aren&rsquo;t in the database yet. Apply the marketing_content migration, then reload.
        </div>
      </div>
    );
  }

  const items = rows ?? [];

  // Live scoreboard — published in the last 7 days.
  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgo = weekAgoDate.toISOString().slice(0, 10);
  const publishedThisWeek = items.filter((i) => i.published_on && i.published_on >= weekAgo);
  const scoreboard = [
    { label: "Long videos / wk", value: publishedThisWeek.filter((i) => i.type === "long_video").length },
    { label: "Shorts / wk", value: publishedThisWeek.filter((i) => i.type === "short").length },
    { label: "POV + field clips / wk", value: publishedThisWeek.filter((i) => i.type === "pov_clip" || i.type === "before_after").length },
    { label: "Ideas in bank", value: items.filter((i) => i.status === "idea").length },
  ];

  // Mint short-lived signed URLs for any uploaded file (voice memos + photos)
  // so the team can play/preview them inline.
  const uploadedItems = items.filter((i) => i.asset_path);
  const signedByPath = new Map<string, string>();
  if (uploadedItems.length > 0) {
    const paths = [...new Set(uploadedItems.map((i) => i.asset_path as string))];
    const { data: signed } = await supabase.storage
      .from("marketing")
      .createSignedUrls(paths, 60 * 60); // 1 hour
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
    }
  }
  const withUrls: ContentWithUrl[] = items.map((i) => ({
    ...i,
    signed_url: i.asset_path ? signedByPath.get(i.asset_path) ?? null : null,
  }));

  // Library filtering
  let libraryItems = withUrls;
  if (type) libraryItems = libraryItems.filter((i) => i.type === type);
  if (service) libraryItems = libraryItems.filter((i) => i.service_line === service);

  const serviceLines = [...new Set(items.map((i) => i.service_line).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            Troy&rsquo;s videos, POV clips, field proof, and voice memos. Master files live in Drive/YouTube — this is the index + pipeline.
          </p>
        </div>
      </div>

      {/* Quick capture — drop a voice memo or photo, categorize in one tap */}
      <QuickCapture serviceLines={SERVICE_LINES} />

      {/* Scoreboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {scoreboard.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-white p-4">
            <p className="text-xs text-ink-3">{s.label}</p>
            <p className="text-2xl font-semibold mt-1 text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-line">
        <Link
          href="/marketing/content?tab=pipeline"
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${view === "pipeline" ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2"}`}
        >
          Pipeline
        </Link>
        <Link
          href="/marketing/content?tab=library"
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${view === "library" ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2"}`}
        >
          Library
        </Link>
      </div>

      {/* Add */}
      <details className="rounded-xl border border-line bg-white p-5">
        <summary className="text-sm font-semibold cursor-pointer select-none">
          Add content (idea, video, or voice memo)
        </summary>
        <div className="mt-4">
          <AddContentForm />
        </div>
      </details>

      {view === "pipeline" ? (
        <PipelineBoard
          items={withUrls.filter((i) => i.status !== "archived")}
          statuses={[...PIPELINE_STATUSES]}
        />
      ) : (
        <LibraryList
          items={libraryItems}
          serviceLines={serviceLines}
          activeType={type ?? null}
          activeService={service ?? null}
        />
      )}
    </div>
  );
}
