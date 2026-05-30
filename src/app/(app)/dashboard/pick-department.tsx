"use client";

import { useTransition } from "react";
import { setMyDepartment } from "./actions";
import {
  DEPARTMENTS,
  DEPARTMENT_LABEL,
  DEPARTMENT_EMOJI,
  DEPARTMENT_DESCRIPTION,
} from "@/lib/departments";

/**
 * One-time prompt shown on /dashboard when the user has no department set.
 * Picking one self-updates the profile and the dashboard re-renders with
 * department-relevant tiles first.
 */
export function PickDepartmentPrompt() {
  const [isPending, startTransition] = useTransition();

  function pick(dept: string) {
    const fd = new FormData();
    fd.set("department", dept);
    startTransition(() => setMyDepartment(fd));
  }

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>👋</span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-blue-900">
            What department are you in?
          </h2>
          <p className="mt-0.5 text-xs text-blue-800/80">
            Pick one and we'll show the tools you use most often first.
            You can change this any time.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DEPARTMENTS.map((dept) => (
          <button
            key={dept}
            type="button"
            onClick={() => pick(dept)}
            disabled={isPending}
            className="group flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-sm hover:border-blue-400 hover:bg-white disabled:opacity-50 transition-colors"
          >
            <span className="text-lg">{DEPARTMENT_EMOJI[dept]}</span>
            <span className="flex-1 min-w-0">
              <span className="block font-medium text-zinc-900">
                {DEPARTMENT_LABEL[dept]}
              </span>
              <span className="block text-xs text-zinc-500 truncate">
                {DEPARTMENT_DESCRIPTION[dept]}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
