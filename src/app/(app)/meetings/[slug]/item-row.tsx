"use client";

import { useTransition } from "react";
import { Check, MessageSquare, Archive } from "lucide-react";
import { updateMeetingItemStatus } from "./actions";
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
              ? "border-green-500 bg-green-500 text-white"
              : "border-zinc-300 hover:border-green-500 active:border-green-600")
          }
          title={isComplete ? "Reopen" : isAction ? "Mark done" : "Mark discussed"}
        >
          {isComplete && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={"text-sm font-medium leading-snug break-words " + (isComplete ? "line-through text-zinc-500" : "text-zinc-900")}>
            {item.title}
          </p>

          {item.body && (
            <p className="text-xs text-zinc-600 mt-1 whitespace-pre-wrap leading-relaxed">
              {item.body}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px]">
            <span className="text-zinc-500">
              {nameOf(author)}{author?.id === currentUserId && " (you)"}
            </span>

            {owner && (
              <>
                <span className="text-zinc-300">·</span>
                <span className={"inline-flex items-center rounded-full border px-2 py-0.5 font-medium " + accentClass}>
                  Owner: {nameOf(owner)}
                </span>
              </>
            )}

            {item.due_date && (
              <>
                <span className="text-zinc-300">·</span>
                <span className="text-zinc-600 tabular-nums">
                  Due {new Date(item.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </>
            )}

            {isCarriedOver && (
              <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 font-bold uppercase tracking-wider text-[9px]">
                Carried over
              </span>
            )}

            {isComplete && (
              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 font-bold uppercase tracking-wider text-[9px]">
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
              className="hidden sm:inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
              title="Mark discussed"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setStatus("archived")}
            disabled={pending}
            className="hidden sm:inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs text-zinc-400 hover:text-red-700 hover:bg-red-50"
            title="Archive"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}
