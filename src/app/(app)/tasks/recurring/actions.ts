"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDays, addWeeks, addMonths, nextDay, setDate, format } from "date-fns";
import type { RecurrenceFreq } from "@/lib/database.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcNextDue(
  freq: RecurrenceFreq,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  from: Date = new Date(),
): Date {
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);

  if (freq === "daily") {
    return addDays(base, 1);
  }
  if (freq === "weekly" || freq === "biweekly") {
    const weeks = freq === "biweekly" ? 2 : 1;
    const dow = dayOfWeek ?? 1; // default Monday
    // nextDay returns next occurrence of that day starting from base
    const candidate = nextDay(base, dow as 0 | 1 | 2 | 3 | 4 | 5 | 6);
    return freq === "biweekly" ? addWeeks(candidate, 1) : candidate;
  }
  if (freq === "monthly") {
    const dom = dayOfMonth ?? 1;
    const candidate = setDate(base, dom);
    if (candidate <= base) return setDate(addMonths(base, 1), dom);
    return candidate;
  }
  return addDays(base, 7);
}

// ─── Create Rule ──────────────────────────────────────────────────────────────

const ruleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assignee_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  freq: z.enum(["daily", "weekly", "biweekly", "monthly"]).default("weekly"),
  day_of_week: z.coerce.number().int().min(0).max(6).optional(),
  day_of_month: z.coerce.number().int().min(1).max(28).optional(),
  lead_days: z.coerce.number().int().min(0).max(30).default(0),
});

export type RuleFormState = { error: string | null; success: boolean };

export async function createRecurringRule(
  _prev: RuleFormState,
  formData: FormData,
): Promise<RuleFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const raw = {
    title:        formData.get("title"),
    description:  formData.get("description") ?? undefined,
    priority:     formData.get("priority") ?? "normal",
    assignee_id:  formData.get("assignee_id") ?? undefined,
    project_id:   formData.get("project_id")  ?? undefined,
    freq:         formData.get("freq")         ?? "weekly",
    day_of_week:  formData.get("day_of_week")  ?? undefined,
    day_of_month: formData.get("day_of_month") ?? undefined,
    lead_days:    formData.get("lead_days")    ?? 0,
  };

  const parsed = ruleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const { data: d } = parsed;
  const assigneeId = d.assignee_id ?? user.id;
  const nextDue = calcNextDue(d.freq, d.day_of_week ?? null, d.day_of_month ?? null);

  const { error } = await supabase.from("recurring_rules").insert({
    title:         d.title,
    description:   d.description || null,
    priority:      d.priority,
    assignee_id:   assigneeId,
    created_by_id: user.id,
    project_id:    d.project_id || null,
    freq:          d.freq,
    day_of_week:   d.day_of_week ?? null,
    day_of_month:  d.day_of_month ?? null,
    lead_days:     d.lead_days,
    next_due:      format(nextDue, "yyyy-MM-dd"),
  });

  if (error) return { error: error.message, success: false };

  revalidatePath("/tasks/recurring");
  return { error: null, success: true };
}

// ─── Toggle Active (admin/office only) ────────────────────────────────────────
// `active = false` is the soft-archive state. Pause/resume is the UX for both
// "temporarily off" and "permanently retired." Hard delete is intentionally
// not exposed — per the soft-delete policy.

async function requireOfficeOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated" as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin","office"].includes(profile.role)) {
    return { user, error: "Only admin and office can manage recurring rules" as const };
  }
  return { user, error: null as null | string };
}

export async function toggleRecurringRule(
  ruleId: string,
  active: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { user, error: authErr } = await requireOfficeOrAdmin(supabase);
  if (authErr || !user) return { error: authErr ?? "Not authenticated" };

  const { error } = await supabase
    .from("recurring_rules")
    .update({ active })
    .eq("id", ruleId);

  if (error) return { error: error.message };
  revalidatePath("/tasks/recurring");
  return { error: null };
}

// ─── Generate Due Tasks (called by cron / API route) ─────────────────────────

export async function generateDueTasks(): Promise<{ generated: number; error: string | null }> {
  const supabase = await createClient();

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: rules, error: rulesErr } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("active", true)
    .lte("next_due", today);

  if (rulesErr) return { generated: 0, error: rulesErr.message };
  if (!rules || rules.length === 0) return { generated: 0, error: null };

  let generated = 0;

  for (const rule of rules) {
    // Compute due_date and create task
    const dueDate = rule.next_due!;

    const { error: taskErr } = await supabase.from("tasks").insert({
      title:             rule.title,
      description:       rule.description,
      priority:          rule.priority,
      status:            "inbox" as const,
      assignee_id:       rule.assignee_id,
      created_by_id:     rule.created_by_id,
      project_id:        rule.project_id,
      department_id:     rule.department_id,
      visibility:        rule.visibility,
      due_date:          dueDate,
      recurring_rule_id: rule.id,
    });

    if (taskErr) continue;

    // Advance next_due
    const nextDueDate = calcNextDue(
      rule.freq as RecurrenceFreq,
      rule.day_of_week,
      rule.day_of_month,
      new Date(dueDate),
    );

    await supabase
      .from("recurring_rules")
      .update({
        last_generated: dueDate,
        next_due:       format(nextDueDate, "yyyy-MM-dd"),
        updated_at:     new Date().toISOString(),
      })
      .eq("id", rule.id);

    generated++;
  }

  revalidatePath("/tasks");
  return { generated, error: null };
}
