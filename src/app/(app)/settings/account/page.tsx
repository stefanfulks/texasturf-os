import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "./account-form";

export const metadata = { title: "Account · Settings · TexasTurf OS" };

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, departments")
    .eq("id", user.id)
    .single() as unknown as {
      data: {
        full_name: string | null;
        email: string;
        role: string | null;
        departments: string[] | null;
      } | null;
    };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-5">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Settings
      </Link>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">Account</h1>
        <p className="text-sm sm:text-base text-zinc-600 mt-1">
          Your name and which departments you work across. Your role is set by an admin.
        </p>
      </div>

      <AccountForm
        fullName={profile?.full_name ?? ""}
        email={profile?.email ?? user.email ?? ""}
        role={profile?.role ?? null}
        departments={profile?.departments ?? []}
      />
    </div>
  );
}
