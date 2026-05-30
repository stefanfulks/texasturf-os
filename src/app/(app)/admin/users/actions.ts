"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEPARTMENTS } from "@/lib/departments";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Not authenticated" as const };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { user, error: "Admin only" as const };
  }
  return { user, error: null as null | string };
}

export type UpdateUserState = { error: string | null; success: boolean };

const updateUserSchema = z.object({
  user_id:     z.string().uuid(),
  role:        z.enum(["admin", "office", "field"]),
  departments: z.array(z.enum(DEPARTMENTS)),
});

export async function updateUser(
  _prev: UpdateUserState,
  formData: FormData,
): Promise<UpdateUserState> {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.user) return { error: auth.error, success: false };

  // departments come in as a comma-separated string from a hidden field
  const deptStr = (formData.get("departments") as string | null) ?? "";
  const departments = deptStr.split(",").map((s) => s.trim()).filter(Boolean);

  const parsed = updateUserSchema.safeParse({
    user_id:     formData.get("user_id"),
    role:        formData.get("role"),
    departments,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((e) => e.message).join(", "), success: false };
  }

  // Don't allow demoting yourself out of admin — sanity check
  if (parsed.data.user_id === auth.user.id && parsed.data.role !== "admin") {
    return { error: "You can't remove your own admin role.", success: false };
  }

  const { error } = await supabase.from("profiles").update({
    role:        parsed.data.role,
    department:  parsed.data.departments[0] ?? null,
    departments: parsed.data.departments,
    updated_at:  new Date().toISOString(),
  } as never).eq("id", parsed.data.user_id);
  if (error) return { error: error.message, success: false };

  revalidatePath("/admin/users");
  return { error: null, success: true };
}
