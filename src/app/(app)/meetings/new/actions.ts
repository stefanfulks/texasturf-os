"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MeetingSection } from "@/lib/meetings/types";

const ROLES = ["admin", "office", "field"] as const;
const DEPARTMENTS = ["sales", "warehouse", "office", "field", "marketing", "financial"] as const;
const CADENCES = ["daily", "weekly", "biweekly", "monthly", "adhoc", "once"] as const;

const schema = z
  .object({
    slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and dashes only"),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    cadence: z.enum(CADENCES),
    day_of_week: z.coerce.number().int().min(0).max(6).optional(),
    day_of_month: z.coerce.number().int().min(1).max(31).optional(),
    scheduled_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    duration_min: z.coerce.number().int().min(5).max(480).optional(),
  })
  .refine((v) => v.cadence !== "once" || !!v.scheduled_on, {
    message: "Pick the date for a one-time meeting",
  });

export type CreateMeetingState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; slug: string };

export async function createMeeting(
  _prev: CreateMeetingState,
  formData: FormData,
): Promise<CreateMeetingState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only admins can create.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { status: "error", message: "Only admins can create meetings." };
  }

  const parsed = schema.safeParse({
    slug: (formData.get("slug") as string | null)?.trim(),
    name: (formData.get("name") as string | null)?.trim(),
    description: (formData.get("description") as string | null)?.trim() || undefined,
    cadence: formData.get("cadence"),
    day_of_week: formData.get("day_of_week") || undefined,
    day_of_month: formData.get("day_of_month") || undefined,
    scheduled_on: (formData.get("scheduled_on") as string | null) || undefined,
    start_time: (formData.get("start_time") as string | null) || undefined,
    duration_min: formData.get("duration_min") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  const allowed_roles = formData.getAll("allowed_roles").filter((v): v is string => typeof v === "string" && (ROLES as readonly string[]).includes(v));
  const allowed_departments = formData.getAll("allowed_departments").filter((v): v is string => typeof v === "string" && (DEPARTMENTS as readonly string[]).includes(v));
  const invited_user_ids = formData
    .getAll("invited_user_ids")
    .filter((v): v is string => typeof v === "string" && z.string().uuid().safeParse(v).success);

  // Sections come in as JSON in a single hidden field — the form widget
  // serializes the editable list of {key,label,emoji,time_min,owner,accent}.
  let sections: MeetingSection[] = [];
  const sectionsRaw = formData.get("sections");
  if (typeof sectionsRaw === "string" && sectionsRaw.trim()) {
    try {
      const parsedSections = JSON.parse(sectionsRaw);
      if (Array.isArray(parsedSections)) {
        sections = parsedSections.filter((s): s is MeetingSection =>
          s && typeof s.key === "string" && typeof s.label === "string" && typeof s.emoji === "string",
        );
      }
    } catch {
      return { status: "error", message: "Sections payload is malformed." };
    }
  }
  if (sections.length === 0) {
    return { status: "error", message: "Add at least one section." };
  }

  type InsertRow = {
    slug: string;
    name: string;
    description: string | null;
    cadence: string;
    day_of_week: number | null;
    day_of_month: number | null;
    scheduled_on: string | null;
    start_time: string | null;
    duration_min: number | null;
    allowed_roles: string[];
    allowed_departments: string[];
    invited_user_ids: string[];
    sections: MeetingSection[];
    created_by: string;
  };
  const insertRow: InsertRow = {
    slug: parsed.data.slug,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    cadence: parsed.data.cadence,
    day_of_week: parsed.data.day_of_week ?? null,
    day_of_month: parsed.data.day_of_month ?? null,
    scheduled_on: parsed.data.cadence === "once" ? parsed.data.scheduled_on ?? null : null,
    start_time: parsed.data.start_time ?? null,
    duration_min: parsed.data.duration_min ?? null,
    allowed_roles,
    allowed_departments,
    invited_user_ids,
    sections,
    created_by: user.id,
  };

  const { error } = await (
    supabase.from("meetings") as unknown as {
      insert: (row: InsertRow) => Promise<{ error: { message: string; code?: string } | null }>;
    }
  ).insert(insertRow);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: `A meeting at /meetings/${parsed.data.slug} already exists — change the URL slug.` };
    }
    return { status: "error", message: error.message };
  }

  revalidatePath("/meetings");
  return { status: "success", slug: parsed.data.slug };
}
