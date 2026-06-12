"use client";

import { useTransition } from "react";
import { Check, MessageSquare, Archive } from "lucide-react";
import { updateMeetingItemStatus } from "./actions";
import { RefText } from "@/components/refs/ref-text";
import type { MeetingItem, MeetingSection, MeetingItemStatus } from "@/lib/meetings/types";

type Profile = { id: string; full_name: string | null; email: string };

function nameOf(p: Profile | null): string {
  if (!p) return "—";
  return p.full_name ?? p.email.split("@")[0];
}

export function ItemRow({
  item,
  section,
  author,
  owner,
  currentUserId,
  accentClass,
}: {
  item: MeetingItem;
  section: MeetingSection;
  author: Profile | null;
  owner: Profile | null;
  currentUserId: string;
  accentClass: string;
}) {
  const [pending, startTransition] = useTransition();

  const setStatus = (status: MeetingItemStatus) => {
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("status", status);
    startTransition(() => updateMeetingItemStatus(fd));
  };

  const isAction = section.is_action ?? false;
  const isComplete = item.status === "done" || item.status === "discussed";
  const isCarriedOver = item.status === "carried_over";

  return (
    <li className={"px-4 py-3 sm:px-5 transition-opacity " + (isComplete ? "opacity-60" : "")}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setStatus(isComplete ? "pending" : isAction ? "done" : "discussed")}
          disabled={pending}
          aria-label={isComplete ? "Reopen" : isAction ? "Mark done" : "Mark discussed"}
          className={
            "mt-0.5 h-6 w-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors " +
            (isComplete
              ? "border-brand/30 bg-brand text-white"
              : "border-line-strong hover:border-brand/30 active:border-brand/30")
          }
          title={isComplete ? "Reopen" : isAction ? "Mark done" : "Mark discussed"}
        >
          {isComplete && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={"text-sm font-medium leading-snug break-words " + (isComplete ? "line-through text-ink-3" : "text-ink")}>
            <RefText text={item.title} />
          </p>

          {item.body && (
            <p className="text-xs text-ink-2 mt-1 whitespace-pre-wrap leading-relaxed">
              <RefText text={item.body} />
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px]">
            <span className="text-ink-3">
              {nameOf(author)}{author?.id === currentUserId && " (you)"}
            </span>

            {owner && (
              <>
                <span className="text-ink-4">·</span>
                <span className={"inline-flex items-center rounded-full border px-2 py-0.5 font-medium " + accentClass}>
                  Owner: {nameOf(owner)}
                </span>
              </>
            )}

            {item.due_date && (
              <>
                <span className="text-ink-4">·</span>
                <span className="text-ink-2 tabular-nums">
                  Due {new Date(item.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </>
            )}

            {isCarriedOver && (
              <span className="rounded-full bg-warn-tint text-warn border border-warn/30 px-2 py-0.5 font-bold uppercase tracking-wider text-[9px]">
                Carried over
              </span>
            )}

            {isComplete && (
              <span className="rounded-full bg-brand-tint text-brand border border-brand/30 px-2 py-0.5 font-bold uppercase tracking-wider text-[9px]">
                {item.status === "done" ? "Done" : "Discussed"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isAction && !isComplete && (
            <button
              type="button"
              onClick={() => setStatus("discussed")}
              disabled={pending}
              className="hidden sm:inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs text-ink-3 hover:text-ink hover:bg-hover"
              title="Mark discussed"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setStatus("archived")}
            disabled={pending}
            className="hidden sm:inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs text-ink-4 hover:text-danger hover:bg-danger-tint"
            title="Archive"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}
