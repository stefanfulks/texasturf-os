"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireOfficeOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated" as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin","office"].includes(profile.role)) {
    return { user, error: "Only admin and office can manage team members" as const };
  }
  return { user, error: null as null | string };
}

export type ArchiveMemberState = { error: string | null; success: boolean };

async function setActive(memberId: string, active: boolean): Promise<ArchiveMemberState> {
  const supabase = await createClient();
  const auth = await requireOfficeOrAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false };
  if (!memberId) return { error: "Team member ID required", success: false };

  const { error } = await supabase.from("team_members")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", memberId);
  if (error) return { error: error.message, success: false };

  revalidatePath("/reports/team");
  revalidatePath(`/reports/team/${memberId}`, "page");
  return { error: null, success: true };
}

export async function archiveTeamMember(_prev: ArchiveMemberState, formData: FormData): Promise<ArchiveMemberState> {
  return setActive(formData.get("member_id") as string, false);
}

export async function unarchiveTeamMember(_prev: ArchiveMemberState, formData: FormData): Promise<ArchiveMemberState> {
  return setActive(formData.get("member_id") as string, true);
}
