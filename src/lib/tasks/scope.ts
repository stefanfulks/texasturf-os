/**
 * Multi-assignee task scoping helpers.
 *
 * `tasks.assignee_id` is the legacy "primary" assignee (back-compat with all
 * existing queries). `task_assignees` is the authoritative join table — a
 * task can have many assignees, only one of which is primary.
 *
 * For UX surfaces where "my tasks" should include tasks I'm co-tagged on
 * (dashboard counts, AI assistant, etc.), filter through this helper instead
 * of `.eq("assignee_id", userId)`.
 */

/**
 * Returns every task id the given user is assigned to (primary or co-),
 * unioning `task_assignees` with the legacy `tasks.assignee_id`.
 *
 * Loose `any` for the client because callers pass both the server-side
 * SSR client and the service-role admin client — they have different
 * generated types but the same `.from().select().eq()` shape.
 */
export async function getMyTaskIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string[]> {
  const [joinRes, legacyRes] = await Promise.all([
    supabase.from("task_assignees").select("task_id").eq("profile_id", userId),
    supabase.from("tasks").select("id").eq("assignee_id", userId),
  ]);
  const ids = new Set<string>();
  for (const r of joinRes.data ?? []) ids.add(r.task_id as string);
  for (const r of legacyRes.data ?? []) ids.add(r.id as string);
  return [...ids];
}

/**
 * A uuid that no real row will ever have. Used by callers that need to
 * force-empty a query when the user has zero matching tasks (so the
 * downstream count stays 0 cleanly).
 */
export const NO_TASK_UUID = "00000000-0000-0000-0000-000000000000";
