"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { setMyDepartment } from "./actions";
import {
  DEPARTMENTS,
  DEPARTMENT_LABEL,
  DEPARTMENT_ICON,
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
      : "rounded-2xl border border-brand-line bg-brand-tint/40 p-5";

  return (
    <section className={wrapperCls}>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>👋</span>
        <div className="flex-1">
          <h2 className={variant === "page" ? "display text-xl text-ink" : "text-sm font-semibold text-ink"}>
            What departments are you in?
          </h2>
          <p className={variant === "page" ? "mt-1 text-sm text-ink-3" : "mt-0.5 text-xs text-ink-2"}>
            Pick one or more. We&apos;ll tailor the dashboard and surface the
            tools your team uses most. You can change this any time.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((dept) => {
          const on = selected.includes(dept);
          const Icon = DEPARTMENT_ICON[dept];
          return (
            <button
              key={dept}
              type="button"
              onClick={() => toggle(dept)}
              disabled={isPending}
              className={
                "group flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50 " +
                (on
                  ? "border-brand bg-brand-tint ring-1 ring-brand-line"
                  : "border-line bg-surface hover:border-line-strong")
              }
              aria-pressed={on}
            >
              <span className={"medallion " + (on ? "medallion-brand" : "")}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-ink">
                  {DEPARTMENT_LABEL[dept]}
                </span>
                <span className="block text-xs text-ink-3">
                  {DEPARTMENT_DESCRIPTION[dept]}
                </span>
              </span>
              {on && (
                <span className="mt-0.5 text-brand" aria-hidden>
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-3">
          {selected.length === 0
            ? "Pick at least one"
            : `${selected.length} selected`}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={isPending || selected.length === 0}
          className="btn btn-primary btn-sm disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save departments"}
        </button>
      </div>
    </section>
  );
}
