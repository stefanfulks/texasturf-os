import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JobForm } from "../job-form";

export const metadata = { title: "New Job · TexasTurf OS" };

export default async function NewJobPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-5 pb-12">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 -ml-1 h-10 text-sm text-ink-3 hover:text-ink active:text-ink-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Jobs
      </Link>
      <div>
        <h1 className="page-title">New Job</h1>
        <p className="text-sm sm:text-base text-ink-2 mt-1">
          Customer install, commercial bid, or other tracked work.
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <JobForm mode="create" />
      </div>
    </div>
  );
}
