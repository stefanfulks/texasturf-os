"use client";

import { useActionState } from "react";
import { updateContentStatus, type ActionState } from "./actions";
import type { ContentWithUrl } from "./page";

const initial: ActionState = { error: null, success: false };

const STATUS_LABEL: Record<string, string> = {
  idea: "Idea",
  scripted: "Scripted",
  scheduled_shoot: "Shoot",
  filmed: "Filmed",
  editing: "Editing",
  ready: "Ready",
  published: "Published",
};

const TYPE_BADGE: Record<string, string> = {
  long_video: "bg-info-tint text-info",
  short: "bg-info-tint text-info",
  pov_clip: "bg-info-tint text-info",
  before_after: "bg-warn-tint text-warn",
  photo_set: "bg-sunken text-ink-2",
  voice_memo: "bg-brand-tint text-brand",
  blog_post: "bg-info-tint text-info",
  other: "bg-hover text-ink-3",
};

function NextButton({ id, status, statuses }: { id: string; status: string; statuses: string[] }) {
  const [state, formAction, isPending] = useActionState(updateContentStatus, initial);
  const idx = statuses.indexOf(status);
  const next = idx >= 0 && idx < statuses.length - 1 ? statuses[idx + 1] : null;
  if (!next) return null;
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        disabled={isPending}
        title={state.error ?? `Move to ${STATUS_LABEL[next]}`}
        className="text-[11px] px-1.5 py-0.5 rounded border border-line text-ink-3 hover:bg-hover disabled:opacity-50"
      >
        → {STATUS_LABEL[next]}
      </button>
    </form>
  );
}

export function PipelineBoard({ items, statuses }: { items: ContentWithUrl[]; statuses: string[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
      {statuses.map((status) => {
        const col = items.filter((i) => i.status === status);
        return (
          <div key={status} className="rounded-xl border border-line bg-hover/50 min-h-24">
            <div className="px-3 py-2 border-b border-line flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-2">{STATUS_LABEL[status]}</span>
              <span className="text-xs text-ink-4">{col.length}</span>
            </div>
            <div className="p-2 space-y-2">
              {col.slice(0, 50).map((i) => (
                <div key={i.id} className="rounded-lg border border-line bg-white p-2.5">
                  <p className="text-xs font-medium text-ink leading-snug">{i.title}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_BADGE[i.type] ?? TYPE_BADGE.other}`}>
                      {i.type.replace(/_/g, " ")}
                    </span>
                    {i.service_line && (
                      <span className="text-[10px] text-ink-4">{i.service_line.replace(/_/g, " ")}</span>
                    )}
                  </div>
                  <div className="mt-1.5">
                    <NextButton id={i.id} status={i.status} statuses={statuses} />
                  </div>
                </div>
              ))}
              {col.length > 50 && <p className="text-[10px] text-ink-4 px-1">+{col.length - 50} more</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
