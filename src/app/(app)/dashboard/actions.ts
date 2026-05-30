"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDepartment } from "@/lib/departments";

/**
 * Let the signed-in user pick their own department. Used by the "What
 * department are you in?" prompt on the dashboard when `profiles.department`
 * is null. RLS allows self-update on profiles.
 */
export async function setMyDepartment(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const dept = formData.get("department");
  if (!isDepartment(dept)) return;

  await supabase
    .from("profiles")
    // department col not yet in generated types until migration regenerates them
    .update({ department: dept } as unknown as never)
    .eq("id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/");
}
