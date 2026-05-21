import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "../project-form";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">← Projects</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New Project</h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <ProjectForm mode="create" />
      </div>
    </div>
  );
}
