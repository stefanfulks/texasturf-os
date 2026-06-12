"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateContentLinks, updateContentCategory, type ActionState } from "./actions";
import type { ContentWithUrl } from "./page";

const SERVICE_LINES = [
  "turf", "xeriscape", "lot_clearing", "pavers", "tree_removal", "excavation",
  "stone_work", "site_prep", "concrete", "courts", "fencing", "welding", "landscape_design",
];

const initial: ActionState = { error: null, success: false };

const TYPE_LABEL: Record<string, string> = {
  long_video: "Long video",
  short: "Short",
  pov_clip: "POV clip",
  before_after: "Before/After",
  photo_set: "Photo set",
  voice_memo: "Voice memo",
  blog_post: "Blog post",
  other: "Other",
};

const TYPE_FILTERS = ["long_video", "short", "pov_clip", "before_after", "photo_set", "voice_memo", "blog_post"] as const;

function ServiceLineChips({ item }: { item: ContentWithUrl }) {
  const [, formAction] = useActionState(updateContentCategory, initial);
  return (
    <form action={formAction} className="flex flex-wrap gap-1 items-center">
      <input type="hidden" name="id" value={item.id} />
      <span className="text-[11px] text-ink-4 mr-1">Tag:</span>
      {SERVICE_LINES.map((s) => (
        <button
          key={s}
          type="submit"
          name="service_line"
          value={s}
          className={`text-[11px] px-2 py-0.5 rounded-full border ${
            item.service_line === s ? "bg-ink text-white border-ink" : "border-line text-ink-3 hover:bg-hover"
          }`}
        >
          {s.replace(/_/g, " ")}
        </button>
      ))}
    </form>
  );
}

function LinkEditor({ item }: { item: ContentWithUrl }) {
  const [state, formAction, isPending] = useActionState(updateContentLinks, initial);
  return (
    <form action={formAction} className="flex items-center gap-1.5 flex-wrap">
      <input type="hidden" name="id" value={item.id} />
      <input
        name="drive_url"
        defaultValue={item.drive_url ?? ""}
        placeholder="Drive URL"
        className="text-xs border border-line rounded px-2 py-1 w-40 bg-white focus:outline-none focus:ring-1 focus:ring-line-strong"
      />
      <input
        name="youtube_url"
        defaultValue={item.youtube_url ?? ""}
        placeholder="YouTube URL"
        className="text-xs border border-line rounded px-2 py-1 w-40 bg-white focus:outline-none focus:ring-1 focus:ring-line-strong"
      />
      <button type="submit" disabled={isPending} className="text-xs px-2 py-1 rounded border border-line hover:bg-hover disabled:opacity-50">
        {isPending ? "…" : "Save"}
      </button>
      {state.success && <span className="text-xs text-brand">✓</span>}
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

export function LibraryList({
  items,
  serviceLines,
  activeType,
  activeService,
}: {
  items: ContentWithUrl[];
  serviceLines: string[];
  activeType: string | null;
  activeService: string | null;
}) {
  const qs = (next: Record<string, string | null>) => {
    const p = new URLSearchParams({ tab: "library" });
    const t = next.type !== undefined ? next.type : activeType;
    const s = next.service !== undefined ? next.service : activeService;
    if (t) p.set("type", t);
    if (s) p.set("service", s);
    return `/marketing/content?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        <Link href={qs({ type: null })} className={`text-xs px-2.5 py-1 rounded-full border ${!activeType ? "bg-ink text-white border-ink" : "border-line text-ink-2 hover:bg-hover"}`}>
          All types
        </Link>
        {TYPE_FILTERS.map((t) => (
          <Link key={t} href={qs({ type: t })} className={`text-xs px-2.5 py-1 rounded-full border ${activeType === t ? "bg-ink text-white border-ink" : "border-line text-ink-2 hover:bg-hover"}`}>
            {TYPE_LABEL[t]}
          </Link>
        ))}
      </div>
      {serviceLines.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Link href={qs({ service: null })} className={`text-xs px-2.5 py-1 rounded-full border ${!activeService ? "bg-ink text-white border-ink" : "border-line text-ink-2 hover:bg-hover"}`}>
            All services
          </Link>
          {serviceLines.map((s) => (
            <Link key={s} href={qs({ service: s })} className={`text-xs px-2.5 py-1 rounded-full border ${activeService === s ? "bg-ink text-white border-ink" : "border-line text-ink-2 hover:bg-hover"}`}>
              {s.replace(/_/g, " ")}
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-line bg-white overflow-hidden">
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-4">Nothing matches that filter.</div>
        ) : (
          <div className="divide-y divide-line">
            {items.map((i) => (
              <div key={i.id} className="px-5 py-3 space-y-2">
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Thumbnail for uploaded photos */}
                  {i.asset_path && i.type !== "voice_memo" && i.signed_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.signed_url} alt={i.title} className="h-12 w-12 rounded object-cover border border-line flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-48">
                    <p className="text-sm font-medium text-ink">{i.title}</p>
                    <p className="text-xs text-ink-4">
                      {TYPE_LABEL[i.type] ?? i.type}
                      {i.service_line ? ` · ${i.service_line.replace(/_/g, " ")}` : ""}
                      {i.status !== "idea" ? ` · ${i.status}` : ""}
                      {i.hook ? ` · ${i.hook}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {i.drive_url && (
                      <a href={i.drive_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded border border-line text-ink-2 hover:bg-hover">Drive</a>
                    )}
                    {i.youtube_url && (
                      <a href={i.youtube_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded border border-line text-ink-2 hover:bg-hover">YouTube</a>
                    )}
                  </div>
                </div>

                {/* Voice memo player */}
                {i.type === "voice_memo" && i.signed_url && (
                  <audio controls preload="none" src={i.signed_url} className="w-full max-w-md h-9">
                    Your browser does not support audio playback.
                  </audio>
                )}
                {i.asset_path && !i.signed_url && (
                  <p className="text-xs text-warn">Preview link expired — refresh to reload.</p>
                )}

                {/* Quick re-categorize by service line */}
                <ServiceLineChips item={i} />

                {/* Link attach for non-uploaded items */}
                {!i.asset_path && <LinkEditor item={i} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
