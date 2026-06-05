"use client";

import { useState, useTransition } from "react";
import { setMyDepartment } from "./actions";
import {
  DEPARTMENTS,
  DEPARTMENT_LABEL,
  DEPARTMENT_EMOJI,
  DEPARTMENT_DESCRIPTION,
  type Department,
} from "@/lib/departments";

/**
 * Multi-select department picker. Used on the dashboard prompt (when
 * departments is empty) and the onboarding flow after first sign-in.
 *
 * Click a department to toggle. Picking one + tapping Save persists.
 */
export function PickDepartmentPrompt({
  initial = [],
  variant = "card",
}: {
  initial?: Department[];
  /** "card" = the blue banner on the dashboard. "page" = full-page onboarding shell. */
  variant?: "card" | "page";
}) {
  const [selected, setSelected] = useState<Department[]>(initial);
  const [isPending, startTransition] = useTransition();

  function toggle(dept: Department) {
    setSelected((cur) =>
      cur.includes(dept) ? cur.filter((d) => d !== dept) : [...cur, dept],
    );
  }

  function save() {
    if (selected.length === 0) return;
    const fd = new FormData();
    fd.set("departments", selected.join(","));
    startTransition(() => setMyDepartment(fd));
  }

  const wrapperCls =
    variant === "page"
      ? "max-w-2xl mx-auto"
      : "rounded-xl border border-blue-200 bg-blue-50 p-5";

  return (
    <section className={wrapperCls}>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>👋</span>
        <div className="flex-1">
          <h2 className={variant === "page" ? "text-xl font-semibold text-zinc-900" : "text-sm font-semibold text-blue-900"}>
            What departments are you in?
          </h2>
          <p className={variant === "page" ? "mt-1 text-sm text-zinc-600" : "mt-0.5 text-xs text-blue-800/80"}>
            Pick one or more. We&apos;ll tailor the dashboard and surface the
            tools your team uses most. You can change this any time.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((dept) => {
          const on = selected.includes(dept);
          return (
            <button
              key={dept}
              type="button"
              onClick={() => toggle(dept)}
              disabled={isPending}
              className={
                "group flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50 " +
                (on
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300"
                  : "border-blue-200 bg-white hover:border-blue-400")
              }
              aria-pressed={on}
            >
              <span className="text-lg leading-none mt-0.5">{DEPARTMENT_EMOJI[dept]}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-zinc-900">
                  {DEPARTMENT_LABEL[dept]}
                </span>
                <span className="block text-xs text-zinc-500">
                  {DEPARTMENT_DESCRIPTION[dept]}
                </span>
              </span>
              {on && (
                <span className="text-blue-500 mt-0.5" aria-hidden>
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {selected.length === 0
            ? "Pick at least one"
            : `${selected.length} selected`}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={isPending || selected.length === 0}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : "Save departments"}
        </button>
      </div>
    </section>
  );
}
