"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DEPARTMENTS = ["sales", "warehouse", "office", "field", "marketing", "financial"] as const;

const schema = z.object({
  full_name: z.string().min(1, "Name is required").max(120).optional(),
});

export type UpdateAccountState = { error: string | null; success: boolean };

export async function updateAccount(
  _prev: UpdateAccountState,
  formData: FormData,
): Promise<UpdateAccountState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse({
    full_name: (formData.get("full_name") as string | null)?.trim() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  const departments = formData
    .getAll("departments")
    .filter((v): v is string => typeof v === "string" && (DEPARTMENTS as readonly string[]).includes(v));

  type UpdatePayload = { full_name?: string; departments?: string[] };
  const payload: UpdatePayload = {};
  if (parsed.data.full_name) payload.full_name = parsed.data.full_name;
  payload.departments = departments;

  // `departments` (array) isn't in the generated profile types yet — cast
  // through unknown so this builds before types are regenerated.
  const { error } = await (
    supabase.from("profiles") as unknown as {
      update: (row: UpdatePayload) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    }
  )
    .update(payload)
    .eq("id", user.id);

  if (error) return { error: error.message, success: false };

  revalidatePath("/settings/account");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
