import { redirect } from "next/navigation";
import { createClient as _createClient } from "@/lib/supabase/server";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function requireAdmin(supabase: Supabase): Promise<
  | { user: { id: string }; error?: undefined }
  | { user?: undefined; error: string }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Admin only" };
  return { user: { id: user.id } };
}

export async function redirectIfNotAdmin(): Promise<void> {
  const supabase = await _createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.user) redirect("/settings");
}
