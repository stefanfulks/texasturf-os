import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Film, Scissors, Camera, Lightbulb, Plus, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { PipelineBoard } from "./pipeline-board";
import { LibraryList } from "./library-list";
import { AddContentForm } from "./add-content-form";
import { QuickCapture } from "./quick-capture";
import { AiComposer } from "./ai-composer";
import { CalendarView } from "./calendar-view";

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
  const view = tab === "library" ? "library" : tab === "calendar" ? "calendar" : "pipeline";
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
      <div className="space-y-5">
        <div>
          <p className="eyebrow mb-2">Marketing</p>
          <h1 className="page-title">Content</h1>
        </div>
        <div className="panel">
          <div className="empty-state">
            <span className="medallion medallion-warn">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="empty-state-title">Content tables aren&rsquo;t set up yet</p>
            <p className="empty-state-body">Apply the marketing_content migration, then reload this page.</p>
          </div>
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
  const scoreboard: Array<{ label: string; value: number; icon: LucideIcon; accent: string }> = [
    { label: "Long videos / wk", value: publishedThisWeek.filter((i) => i.type === "long_video").length, icon: Film, accent: "stat-accent-brand" },
    { label: "Shorts / wk", value: publishedThisWeek.filter((i) => i.type === "short").length, icon: Scissors, accent: "" },
    { label: "POV + field clips / wk", value: publishedThisWeek.filter((i) => i.type === "pov_clip" || i.type === "before_after").length, icon: Camera, accent: "" },
    { label: "Ideas in bank", value: items.filter((i) => i.status === "idea").length, icon: Lightbulb, accent: "stat-accent-warn" },
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
      <header className="reveal">
        <p className="eyebrow mb-2">Marketing</p>
        <h1 className="page-title">Content</h1>
        <p className="page-sub">
          Troy&rsquo;s videos, POV clips, field proof, and voice memos. Master files
          live in Drive/YouTube — this is the index + pipeline.
        </p>
      </header>

      {/* Quick capture — drop a voice memo or photo, categorize in one tap */}
      <QuickCapture serviceLines={SERVICE_LINES} />

      {/* Scoreboard */}
      <div className="reveal grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        {scoreboard.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`stat ${s.accent}`}>
              <div className="flex items-start justify-between">
                <span className="stat-label">{s.label}</span>
                <span className="medallion medallion-brand !h-7 !w-7 !rounded-[9px]">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <span className="stat-value">{s.value}</span>
            </div>
          );
        })}
      </div>

      {/* Tabs + add */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="segmented">
          <Link href="/marketing/content?tab=pipeline" data-active={view === "pipeline"}>Pipeline</Link>
          <Link href="/marketing/content?tab=calendar" data-active={view === "calendar"}>Calendar</Link>
          <Link href="/marketing/content?tab=library" data-active={view === "library"}>Library</Link>
        </div>
      </div>

      {/* Draft with AI — rough idea in, filming-ready card out */}
      <AiComposer aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />

      {/* Add */}
      <details className="panel group">
        <summary className="flex cursor-pointer select-none list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-hover">
          <span className="medallion medallion-brand">
            <Plus className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Add content</span>
            <span className="block text-xs text-ink-3">An idea, a finished video, or a voice memo.</span>
          </span>
        </summary>
        <div className="border-t border-line p-5">
          <AddContentForm />
        </div>
      </details>

      {view === "pipeline" ? (
        // Keyed on newest-id + count: the board holds optimistic local state,
        // so remount it when items are added/removed (AI composer, add form)
        // — but not on drags, where the id set is unchanged.
        <PipelineBoard
          key={`${withUrls.length}-${withUrls[0]?.id ?? "empty"}`}
          items={withUrls.filter((i) => i.status !== "archived")}
          statuses={[...PIPELINE_STATUSES]}
          aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
        />
      ) : view === "calendar" ? (
        <CalendarView items={withUrls.filter((i) => i.status !== "archived")} />
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
