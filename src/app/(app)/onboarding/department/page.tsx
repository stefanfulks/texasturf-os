import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PickDepartmentPrompt } from "../../dashboard/pick-department";
import { parseDepartments } from "@/lib/departments";

export const metadata = { title: "Welcome · TexasTurf OS" };

/**
 * First-time onboarding screen — pick your department(s). The dashboard
 * still shows an inline prompt for users who came in before this existed,
 * but new sign-ups land here on first visit.
 */
export default async function DepartmentOnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, departments")
    .eq("id", user.id)
    .single() as unknown as {
      data: { full_name: string | null; email: string; departments: unknown } | null;
    };

  const departments = parseDepartments(profile?.departments);
  // Already onboarded → go straight to the dashboard.
  if (departments.length > 0) redirect("/dashboard");

  const greetingName =
    profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "there";

  return (
    <div className="py-12">
      <div className="max-w-2xl mx-auto text-center mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome, {greetingName}.</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Quick setup so we can show you the right tools — pick one or more
          departments that describe your day-to-day work.
        </p>
      </div>
      <PickDepartmentPrompt variant="page" />
    </div>
  );
}
