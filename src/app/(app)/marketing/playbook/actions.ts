"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type WeeklyPlanResult = {
  error?: string;
  providerMissing?: boolean;
  created?: Array<{ title: string; assignee: string }>;
};

/** Plan this week with AI: one filming-ready card per pillar, inserted into
 * the Content board as ideas (flagged is_ai_generated). Seasonal context is
 * pulled from the owner's real business inputs when filled. */
export async function aiPlanThisWeek(): Promise<WeeklyPlanResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: inputs } = await supabase
    .from("marketing_business_inputs")
    .select("input_key, value")
    .in("input_key", ["seasonal_priority", "priority_service_lines"]);
  const inputVal = (key: string) =>
    inputs?.find((i) => i.input_key === key)?.value?.trim() || null;

  const weekOf = new Date().toISOString().slice(0, 10);
  const { generateWeeklyPlan, logAiGeneration } = await import("@/lib/ai/marketing");
  const result = await generateWeeklyPlan({
    weekOf,
    seasonalPriority: inputVal("seasonal_priority"),
    priorityServiceLines: inputVal("priority_service_lines"),
  });
  if (!result.ok) {
    if (result.error === "provider_missing") return { providerMissing: true, error: result.message };
    return { error: result.message };
  }

  const cards = result.data.cards.slice(0, 6); // hard cap regardless of model output
  const rows = cards.map((card) => ({
    title: card.title,
    type: card.type,
    status: "idea" as const,
    tag: card.tag,
    assignee: card.assignee,
    service_line: card.service_line,
    hook: card.hook,
    script_md: card.script_md,
    shot_list_md: card.shot_list_md,
    b_roll_md: card.b_roll_md,
    props_md: card.props_md,
    is_ai_generated: true,
    creator_id: user.id,
    created_by_id: user.id,
  }));
  const { error } = await supabase.from("content_items").insert(rows);
  if (error) return { error: error.message };

  await logAiGeneration(supabase, {
    section: "playbook",
    generation_type: "weekly_plan",
    input: {
      week_of: weekOf,
      seasonal_priority: inputVal("seasonal_priority"),
      priority_service_lines: inputVal("priority_service_lines"),
    },
    output: result.data,
    linked_table: "content_items",
    created_by: user.id,
  });

  revalidatePath("/marketing/content");
  revalidatePath("/marketing/playbook");
  revalidatePath("/marketing");
  return { created: cards.map((c) => ({ title: c.title, assignee: c.assignee })) };
}
