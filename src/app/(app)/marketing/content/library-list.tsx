"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateContentLinks, type ActionState } from "./actions";
import type { ContentWithUrl } from "./page";

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

function LinkEditor({ item }: { item: ContentWithUrl }) {
  const [state, formAction, isPending] = useActionState(updateContentLinks, initial);
  return (
    <form action={formAction} className="flex items-center gap-1.5 flex-wrap">
      <input type="hidden" name="id" value={item.id} />
      <input
        name="drive_url"
        defaultValue={item.drive_url ?? ""}
        placeholder="Drive URL"
        className="text-xs border border-zinc-200 rounded px-2 py-1 w-40 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
      />
      <input
        name="youtube_url"
        defaultValue={item.youtube_url ?? ""}
        placeholder="YouTube URL"
        className="text-xs border border-zinc-200 rounded px-2 py-1 w-40 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
      />
      <button type="submit" disabled={isPending} className="text-xs px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50">
        {isPending ? "…" : "Save"}
      </button>
      {state.success && <span className="text-xs text-emerald-700">✓</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
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
        <Link href={qs({ type: null })} className={`text-xs px-2.5 py-1 rounded-full border ${!activeType ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
          All types
        </Link>
        {TYPE_FILTERS.map((t) => (
          <Link key={t} href={qs({ type: t })} className={`text-xs px-2.5 py-1 rounded-full border ${activeType === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
            {TYPE_LABEL[t]}
          </Link>
        ))}
      </div>
      {serviceLines.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Link href={qs({ service: null })} className={`text-xs px-2.5 py-1 rounded-full border ${!activeService ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
            All services
          </Link>
          {serviceLines.map((s) => (
            <Link key={s} href={qs({ service: s })} className={`text-xs px-2.5 py-1 rounded-full border ${activeService === s ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
              {s.replace(/_/g, " ")}
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">Nothing matches that filter.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {items.map((i) => (
              <div key={i.id} className="px-5 py-3 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-48">
                    <p className="text-sm font-medium text-zinc-900">{i.title}</p>
                    <p className="text-xs text-zinc-400">
                      {TYPE_LABEL[i.type] ?? i.type}
                      {i.service_line ? ` · ${i.service_line.replace(/_/g, " ")}` : ""}
                      {i.status !== "idea" ? ` · ${i.status}` : ""}
                      {i.hook ? ` · ${i.hook}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {i.drive_url && (
                      <a href={i.drive_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50">Drive</a>
                    )}
                    {i.youtube_url && (
                      <a href={i.youtube_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50">YouTube</a>
                    )}
                  </div>
                </div>

                {/* Voice memo player */}
                {i.type === "voice_memo" && i.signed_audio_url && (
                  <audio controls preload="none" src={i.signed_audio_url} className="w-full max-w-md h-9">
                    Your browser does not support audio playback.
                  </audio>
                )}
                {i.type === "voice_memo" && !i.signed_audio_url && i.asset_path && (
                  <p className="text-xs text-amber-600">Audio link expired — refresh to play.</p>
                )}

                {/* Link attach for non-voice items */}
                {i.type !== "voice_memo" && <LinkEditor item={i} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
