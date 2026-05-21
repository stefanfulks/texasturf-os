"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const projectSchema = z.object({
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

export type ProjectFormState = { error: string | null; success: boolean };

export async function createProject(_prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const raw = Object.fromEntries(
    ["name","type","status","priority","customer_name","address","description","due_date","target_install_date","jobber_url"]
      .map((k) => [k, formData.get(k) ?? undefined])
  );

  const parsed = projectSchema.safeParse(raw);
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

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(_prev: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", success: false };

  const id = formData.get("id") as string;
  const raw = Object.fromEntries(
    ["name","type","status","priority","customer_name","address","description","due_date","target_install_date","jobber_url"]
      .map((k) => [k, formData.get(k) ?? undefined])
  );

  const parsed = projectSchema.safeParse(raw);
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

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`, "page");
  return { error: null, success: true };
}
