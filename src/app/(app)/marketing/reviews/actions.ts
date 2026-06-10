"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clientDisplayName, primaryEmail, primaryPhone } from "@/lib/marketing/jobber-contacts";
import type { Database } from "@/lib/database.types";

export type ActionState = { error: string | null; success: boolean; info?: string };

type ReviewInsert = Database["public"]["Tables"]["review_outreach"]["Insert"];

const PAGE = 1000;

/**
 * Build the review ask-list from completed Jobber jobs in the last N days
 * (default 90). Existing rows are kept (unique on jobber_job_id), so re-running
 * only adds newly-completed jobs.
 */
export async function buildReviewList(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const days = Number(formData.get("days") ?? 90) || 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString();

  // Completed jobs since cutoff → cache client_id + job info.
  type JobRow = { id: string; client_id: string | null; title: string | null; completed_at: string | null };
  const jobs: JobRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("jobber_jobs")
      .select("id, client_id, title, completed_at")
      .not("completed_at", "is", null)
      .gte("completed_at", cutoffISO)
      .order("completed_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return { error: `Jobs query failed: ${error.message}`, success: false };
    jobs.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  if (jobs.length === 0) {
    return { error: null, success: true, info: `No completed jobs in the last ${days} days — list unchanged.` };
  }

  // Hydrate client contact info.
  const clientIds = [...new Set(jobs.map((j) => j.client_id).filter(Boolean))] as string[];
  const clientById = new Map<string, { name: string; phone: string | null; email: string | null }>();
  for (let i = 0; i < clientIds.length; i += 200) {
    const chunk = clientIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from("jobber_clients")
      .select("id, first_name, last_name, company_name, phones, emails")
      .in("id", chunk);
    if (error) return { error: `Clients query failed: ${error.message}`, success: false };
    for (const c of data ?? []) {
      clientById.set(c.id, { name: clientDisplayName(c), phone: primaryPhone(c.phones), email: primaryEmail(c.emails) });
    }
  }

  const rows: ReviewInsert[] = jobs.map((j) => {
    const c = j.client_id ? clientById.get(j.client_id) : undefined;
    return {
      jobber_job_id: j.id,
      jobber_client_id: j.client_id,
      client_name: c?.name ?? "Unknown client",
      client_phone: c?.phone ?? null,
      client_email: c?.email ?? null,
      job_title: j.title,
      completed_on: j.completed_at ? j.completed_at.slice(0, 10) : null,
    };
  });

  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data, error } = await supabase
      .from("review_outreach")
      .upsert(chunk, { onConflict: "jobber_job_id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: `List insert failed: ${error.message}`, success: false };
    added += data?.length ?? 0;
  }

  revalidatePath("/marketing/reviews");
  revalidatePath("/marketing");
  return {
    error: null,
    success: true,
    info: `Ask-list refreshed: ${added} job${added === 1 ? "" : "s"} added (${rows.length} completed in ${days} days; existing untouched).`,
  };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "requested", "received", "declined"]),
  platform: z.enum(["google", "facebook", "jobber", "other"]).optional(),
});

/** Update a review row's status (and where the review landed). */
export async function updateReviewStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    platform: formData.get("platform") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const patch: Database["public"]["Tables"]["review_outreach"]["Update"] = {
    status: parsed.data.status,
    owner_id: user.id,
  };
  if (parsed.data.platform) patch.platform = parsed.data.platform;
  if (parsed.data.status === "requested") patch.requested_at = new Date().toISOString();
  if (parsed.data.status === "received") patch.received_at = new Date().toISOString();

  const { error } = await supabase.from("review_outreach").update(patch).eq("id", parsed.data.id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/marketing/reviews");
  revalidatePath("/marketing");
  return { error: null, success: true };
}
