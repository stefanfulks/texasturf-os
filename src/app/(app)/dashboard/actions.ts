"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDepartment, type Department } from "@/lib/departments";

/**
 * Let the signed-in user pick their own department(s). Used by the
 * "What department(s) are you in?" prompt on the dashboard and the
 * onboarding flow. RLS allows self-update on profiles.
 *
 * Accepts either a single `department` field (backward compatible with
 * earlier UI) or a `departments` field containing a comma-separated list
 * of department keys.
 */
export async function setMyDepartment(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Multi-select: prefer a comma-separated `departments` field if present,
  // else fall back to single-select `department`.
  let depts: Department[] = [];

  const multi = formData.get("departments");
  if (typeof multi === "string" && multi.length > 0) {
    depts = multi
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is Department => isDepartment(s));
  } else {
    const single = formData.get("department");
    if (isDepartment(single)) depts = [single];
  }

  if (depts.length === 0) return;

  await supabase
    .from("profiles")
    .update({
      department: depts[0],     // legacy single-column (trigger keeps in sync)
      departments: depts,
    } as unknown as never)
    .eq("id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/onboarding/department");
}
