"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { upcomingOccurrence, occurrenceOffset } from "@/lib/meetings/cadence";
import type { Meeting } from "@/lib/meetings/types";

// ─── Create a meeting item ───────────────────────────────────────────────────

const createSchema = z.object({
  meeting_id:   z.string().uuid(),
  section_key:  z.string().min(1),
  // 500 not 280: inline #[Label](type:id) ref tokens inflate the raw length.
  title:        z.string().min(1, "Title is required").max(500),
  body:         z.string().max(4000).optional(),
  occurs_on:    z.string().optional(),
  owner_id:     z.string().uuid().optional(),
  due_date:     z.string().optional(),
});

export type CreateMeetingItemState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; id: string };

export async function createMeetingItem(
  _prev: CreateMeetingItemState,
  formData: FormData,
): Promise<CreateMeetingItemState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const raw = {
    meeting_id:  formData.get("meeting_id"),
    section_key: formData.get("section_key"),
    title:       (formData.get("title") as string | null)?.trim(),
    body:        (formData.get("body") as string | null)?.trim() || undefined,
    occurs_on:   (formData.get("occurs_on") as string | null) || undefined,
    owner_id:    (formData.get("owner_id") as string | null) || undefined,
    due_date:    (formData.get("due_date") as string | null) || undefined,
  };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues.map((e) => e.message).join(", ") };
  }

  // Resolve occurs_on: if not provided, fetch the meeting cadence and compute.
  let occursOn = parsed.data.occurs_on;
  if (!occursOn) {
    const { data: m } = await (
      supabase.from("meetings") as unknown as {
        select: (cols: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: Pick<Meeting, "cadence" | "day_of_week" | "day_of_month" | "scheduled_on"> | null }> } };
      }
    )
      .select("cadence, day_of_week, day_of_month, scheduled_on")
      .eq("id", parsed.data.meeting_id)
      .single();
    if (!m) return { status: "error", message: "Meeting not found" };
    occursOn = upcomingOccurrence(m);
  }

  type InsertRow = {
    meeting_id: string;
    section_key: string;
    title: string;
    body: string | null;
    occurs_on: string;
    owner_id: string | null;
    due_date: string | null;
    author_id: string;
  };
  const insertRow: InsertRow = {
    meeting_id:  parsed.data.meeting_id,
    section_key: parsed.data.section_key,
    title:       parsed.data.title!,
    body:        parsed.data.body ?? null,
    occurs_on:   occursOn,
    owner_id:    parsed.data.owner_id ?? null,
    due_date:    parsed.data.due_date ?? null,
    author_id:   user.id,
  };

  const { data, error } = await (
    supabase.from("meeting_items") as unknown as {
      insert: (row: InsertRow) => {
        select: (cols: string) => {
          single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    }
  )
    .insert(insertRow)
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: error?.message ?? "Failed to save item." };
  }

  revalidatePath(`/meetings`);
  return { status: "success", id: data.id };
}

// ─── Update item status ──────────────────────────────────────────────────────

export async function updateMeetingItemStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = (formData.get("id") as string | null)?.trim();
  const status = (formData.get("status") as string | null)?.trim();
  if (!id || !status) return;
  if (!["pending", "carried_over", "discussed", "done", "archived"].includes(status)) return;

  await (
    supabase.from("meeting_items") as unknown as {
      update: (row: { status: string }) => { eq: (c: string, v: string) => Promise<unknown> };
    }
  )
    .update({ status })
    .eq("id", id);

  revalidatePath("/meetings");
}

// ─── Carry open items forward to the next occurrence ────────────────────────

export async function carryMeetingItemsForward(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meetingId = (formData.get("meeting_id") as string | null)?.trim();
  const occursOn = (formData.get("occurs_on") as string | null)?.trim();
  if (!meetingId || !occursOn) return;

  // Need the cadence to step forward one occurrence.
  const { data: m } = await (
    supabase.from("meetings") as unknown as {
      select: (cols: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: Pick<Meeting, "cadence"> | null }> } };
    }
  )
    .select("cadence")
    .eq("id", meetingId)
    .single();
  if (!m) return;
  // A one-time meeting has nowhere to roll items forward to.
  if (m.cadence === "once") return;

  const nextOn = occurrenceOffset(occursOn, m, 1);

  await (
    supabase.from("meeting_items") as unknown as {
      update: (row: { occurs_on: string; status: string }) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => {
            in: (c: string, v: string[]) => Promise<unknown>;
          };
        };
      };
    }
  )
    .update({ occurs_on: nextOn, status: "carried_over" })
    .eq("meeting_id", meetingId)
    .eq("occurs_on", occursOn)
    .in("status", ["pending", "carried_over"]);

  revalidatePath("/meetings");
}
