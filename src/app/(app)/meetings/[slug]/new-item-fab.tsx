"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, AlertCircle } from "lucide-react";
import { createMeetingItem } from "./actions";
import { RefInput } from "@/components/refs/ref-input";
import type { Meeting } from "@/lib/meetings/types";

// 16px font + 48px height keeps the form iOS-friendly (no auto-zoom, big taps).
const fieldCls =
  "w-full h-12 text-base border border-zinc-300 rounded-xl px-3 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 bg-white";

type Profile = { id: string; full_name: string | null; email: string };

export function NewItemFab({
  meeting,
  occursOn,
  profiles,
  defaultSectionKey,
  inline = false,
}: {
  meeting: Meeting;
  occursOn: string;
  profiles: Profile[];
  defaultSectionKey?: string;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sectionKey, setSectionKey] = useState<string>(defaultSectionKey ?? meeting.sections[0]?.key ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const section = meeting.sections.find((s) => s.key === sectionKey) ?? meeting.sections[0] ?? null;

  function openModal() {
    setError(null);
    setSectionKey(defaultSectionKey ?? meeting.sections[0]?.key ?? "");
    setTitle("");
    setBody("");
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createMeetingItem({ status: "idle" }, fd);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      if (result.status === "success") {
        setOpen(false);
        router.refresh();
      }
    });
  }

  const trigger = inline ? (
    <button
      type="button"
      onClick={openModal}
      className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-white border border-transparent hover:border-zinc-200 active:bg-zinc-50"
      aria-label={`Add to ${section?.label ?? "agenda"}`}
      title="Add item"
    >
      <Plus className="h-4 w-4" />
    </button>
  ) : (
    <button
      type="button"
      onClick={openModal}
      className="sm:hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 inline-flex items-center gap-2 h-14 px-5 rounded-full bg-zinc-900 text-white text-sm font-semibold shadow-lg active:bg-zinc-700"
    >
      <Plus className="h-5 w-5" />
      Add item
    </button>
  );

  return (
    <>
      {trigger}

      {/* Desktop top-level "Add item" button — only shows when not inline. */}
      {!inline && !open && (
        <div className="hidden sm:block fixed top-20 right-6 z-10">
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-zinc-900 text-white text-sm font-semibold shadow-sm hover:bg-zinc-800 active:bg-zinc-700"
          >
            <Plus className="h-4 w-4" />
            Add item
          </button>
        </div>
      )}

      {open && section && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-white w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-zinc-900 truncate">Add to {meeting.name}</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Lands in this meeting&apos;s agenda for next time.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                  <input type="hidden" name="meeting_id" value={meeting.id} />
                  <input type="hidden" name="occurs_on" value={occursOn} />
                  <input type="hidden" name="section_key" value={sectionKey} />

                  {/* Section picker — tiles for big tap targets. */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-2">Section</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {meeting.sections.map((s) => {
                        const active = sectionKey === s.key;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => setSectionKey(s.key)}
                            className={
                              "flex items-center gap-2 h-11 px-3 rounded-xl border text-sm font-medium text-left transition-colors " +
                              (active
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50")
                            }
                          >
                            <span className="text-base leading-none">{s.emoji}</span>
                            <span className="truncate">{s.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <RefInput
                      name="title"
                      value={title}
                      onChange={setTitle}
                      required
                      autoFocus
                      placeholder={section.placeholder ?? "Short summary"}
                      className={fieldCls}
                    />
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Type <span className="font-semibold text-zinc-500">#</span> to link a task, job, invoice, or client
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Details <span className="font-normal text-zinc-400">(optional)</span>
                    </label>
                    <RefInput
                      name="body"
                      value={body}
                      onChange={setBody}
                      multiline
                      rows={4}
                      placeholder="Background, links, context… (# to link)"
                      className="w-full text-base border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 placeholder:text-zinc-400 resize-none"
                    />
                  </div>

                  {section.wants_owner && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                        Owner <span className="font-normal text-zinc-400">(optional)</span>
                      </label>
                      <select name="owner_id" defaultValue="" className={fieldCls}>
                        <option value="">Unassigned</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {section.wants_due && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                        Due date <span className="font-normal text-zinc-400">(optional)</span>
                      </label>
                      <input type="date" name="due_date" className={fieldCls} />
                    </div>
                  )}

                  {error && (
                    <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-100 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-11 px-4 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="h-11 px-5 text-sm font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50"
                  >
                    {pending ? "Adding…" : "Add to agenda"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
