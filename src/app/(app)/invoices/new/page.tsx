import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceUploadForm } from "./invoice-upload-form";
import type { Vendor } from "@/lib/database.types";

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vendorsData } = await supabase
    .from("vendors")
    .select("*")
    .eq("active", true)
    .order("name");

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-6">← Invoices</Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Submit Invoice</h1>
        <p className="text-sm text-zinc-500 mt-1">Upload your invoice or receipt. We&apos;ll extract the details automatically.</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <InvoiceUploadForm vendors={(vendorsData ?? []) as Vendor[]} />
      </div>
    </div>
  );
}
