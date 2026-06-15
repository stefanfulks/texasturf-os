"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import type { Deal, Stage, StageTask } from "@/lib/sales/types";
import { STAGE_LABELS, STAGE_TASK_TEMPLATES } from "@/lib/sales/labels";
import { cn } from "@/lib/utils";
import { toggleStageTask } from "@/app/(app)/sales/actions";

/** Seed a stage's checklist from the template when the deal has none yet. */
function tasksFor(deal: Deal): StageTask[] {
  const existing = deal.stage_tasks?.[deal.stage];
  if (existing && existing.length) return existing;
  return (STAGE_TASK_TEMPLATES[deal.stage] ?? []).map((label, i) => ({
    id: `${deal.stage}-${i}`,
    label,
    done: false,
  }));
}

export function StageTasks({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<StageTask[]>(() => tasksFor(deal));

  if (!tasks.length) return null;
  const done = tasks.filter((t) => t.done).length;

  async function toggle(taskId: string) {
    const next = tasks.map((t) =>
      t.id === taskId ? { ...t, done: !t.done } : t,
    );
    setTasks(next);
    const stageTasks: Partial<Record<Stage, StageTask[]>> = {
      ...deal.stage_tasks,
      [deal.stage]: next,
    };
    await toggleStageTask(deal.id, stageTasks);
    router.refresh();
  }

  return (
    <div className="card px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <ListChecks className="size-3.5 text-brand" strokeWidth={2.2} />
          {STAGE_LABELS[deal.stage]} tasks
        </span>
        <span className="eyebrow text-[9px]">
          {done}/{tasks.length} complete
        </span>
      </div>
      <div className="space-y-1">
        {tasks.map((t) => (
          <label
            key={t.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-hover"
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggle(t.id)}
              className="size-3.5 accent-[var(--color-brand)]"
            />
            <span
              className={cn("text-[13px] text-ink", t.done && "text-ink-3 line-through")}
            >
              {t.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
