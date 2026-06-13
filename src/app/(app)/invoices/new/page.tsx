import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceUploadForm } from "./invoice-upload-form";
import type { Vendor } from "@/lib/db-helpers.types";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<{ project?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = (await searchParams) ?? {};

  const [vendorsRes, projectRes] = await Promise.all([
    supabase.from("vendors").select("*").eq("active", true).order("name"),
    // Pre-link to a job when arriving from a job's "Upload →" action. RLS
    // scopes this, so an inaccessible id just yields no link (no banner).
    params.project
      ? supabase.from("projects").select("id, name").eq("id", params.project).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const linkedProject = (projectRes.data ?? null) as { id: string; name: string } | null;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-6">← Invoices</Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Submit Invoice</h1>
        <p className="text-sm text-ink-3 mt-1">Upload your invoice or receipt. We&apos;ll extract the details automatically.</p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-6">
        <InvoiceUploadForm vendors={(vendorsRes.data ?? []) as Vendor[]} linkedProject={linkedProject} />
      </div>
    </div>
  );
}
