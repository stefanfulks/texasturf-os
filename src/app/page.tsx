import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseDepartments } from "@/lib/departments";

// Middleware sends unauthenticated users to /login. Once signed in, route to
// /onboarding/department on first visit (no departments picked yet), else
// straight to the personal dashboard.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("departments, department")
    .eq("id", user.id)
    .single() as unknown as {
      data: { departments: unknown; department: string | null } | null;
    };

  const departments = parseDepartments(profile?.departments);
  // Backwards compatible — accept single legacy column too.
  if (departments.length === 0 && !profile?.department) {
    redirect("/onboarding/department");
  }
  redirect("/dashboard");
}
