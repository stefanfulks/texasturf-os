"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function setArchived(formData: FormData, archived: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Hard role check — RLS would also block, but failing earlier gives a better
  // error path.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return;

  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  await (
    supabase.from("meetings") as unknown as {
      update: (row: { archived: boolean }) => { eq: (c: string, v: string) => Promise<unknown> };
    }
  )
    .update({ archived })
    .eq("id", id);

  revalidatePath("/settings/meetings");
  revalidatePath("/meetings");
}

export async function archiveMeeting(formData: FormData) {
  return setArchived(formData, true);
}

export async function unarchiveMeeting(formData: FormData) {
  return setArchived(formData, false);
}
