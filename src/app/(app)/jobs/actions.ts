"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// "Jobs" are the customer-facing work units (installs, bids, warranties,
// etc.). They live in the public.projects table for back-compat; the URL
// and UI label moved from "Projects" → "Jobs" so that the new bigger
// "Projects" concept (milestones + updates + subtasks) can be built fresh.

const jobSchema = z.object({
  name:                z.string().min(1, "Name is required"),
  type:                z.enum(["customer_install","commercial_bid","sales_marketing","operations","warehouse","admin","strategic","warranty","technology"]),
  status:              z.enum(["intake","planning","waiting_customer","waiting_internal","scheduled","in_progress","blocked","ready_for_review","complete","on_hold","cancelled"]).default("intake"),
  priority:            z.enum(["low","normal","high","urgent"]).default("normal"),
  customer_name:       z.string().optional(),
  address:             z.string().optional(),
  description:         z.string().optional(),
  due_date:            z.string().optional(),
  target_install_date: z.string().optional(),
  jobber_url:          z.string().optional(),
});

export type JobFormState = { error: string | null; success: boolean };

const FIELDS = ["name","type","status","priority","customer_name","address","description","due_date","target_install_date","jobber_url"] as const;

export async function createJob(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const raw = Object.fromEntries(FIELDS.map((k) => [k, formData.get(k) ?? undefined]));
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      ...parsed.data,
      customer_name:       parsed.data.customer_name       || null,
      address:             parsed.data.address             || null,
      description:         parsed.data.description         || null,
      due_date:            parsed.data.due_date            || null,
      target_install_date: parsed.data.target_install_date || null,
      jobber_url:          parsed.data.jobber_url          || null,
      owner_id:    user.id,
      created_by_id: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, success: false };

  revalidatePath("/jobs");
  redirect(`/jobs/${data.id}`);
}

export async function updateJob(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const id = formData.get("id") as string;
  const raw = Object.fromEntries(FIELDS.map((k) => [k, formData.get(k) ?? undefined]));
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };

  const { error } = await supabase
    .from("projects")
    .update({
      ...parsed.data,
      customer_name:       parsed.data.customer_name       || null,
      address:             parsed.data.address             || null,
      description:         parsed.data.description         || null,
      due_date:            parsed.data.due_date            || null,
      target_install_date: parsed.data.target_install_date || null,
      jobber_url:          parsed.data.jobber_url          || null,
    })
    .eq("id", id);

  if (error) return { error: error.message, success: false };

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`, "page");
  return { error: null, success: true };
}

// ─── Archive / Unarchive ──────────────────────────────────────────────────────

async function requireOfficeOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated" as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin","office"].includes(profile.role)) {
    return { user, error: "Only admin and office can archive jobs" as const };
  }
  return { user, error: null as null | string };
}

export type ArchiveJobState = { error: string | null; success: boolean };

async function setJobArchived(jobId: string, archived: boolean): Promise<ArchiveJobState> {
  const supabase = await createClient();
  const { user, error: authErr } = await requireOfficeOrAdmin(supabase);
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };
  if (!jobId) return { error: "Job ID required", success: false };

  const { error } = await supabase.from("projects")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) return { error: error.message, success: false };

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`, "page");
  return { error: null, success: true };
}

export async function archiveJob(_prev: ArchiveJobState, formData: FormData): Promise<ArchiveJobState> {
  return setJobArchived(formData.get("job_id") as string, true);
}

export async function unarchiveJob(_prev: ArchiveJobState, formData: FormData): Promise<ArchiveJobState> {
  return setJobArchived(formData.get("job_id") as string, false);
}

// ─── Link to a Jobber job ─────────────────────────────────────────────────────

export type LinkJobberJobState = { error: string | null; success: boolean };

/**
 * Connect (or disconnect) an OS job to its Jobber job. Office/admin only.
 * `jobberJobId` is jobber_jobs.id, or null to unlink.
 */
export async function linkJobberJob(
  projectId: string,
  jobberJobId: string | null,
): Promise<LinkJobberJobState> {
  const supabase = await createClient();
  const { user, error: authErr } = await requireOfficeOrAdmin(supabase);
  if (authErr || !user) return { error: authErr ?? "Not authenticated", success: false };
  if (!projectId) return { error: "Job ID required", success: false };

  const { error } = await supabase
    .from("projects")
    .update({ jobber_job_id: jobberJobId, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) return { error: error.message, success: false };

  revalidatePath(`/jobs/${projectId}`, "page");
  return { error: null, success: true };
}
