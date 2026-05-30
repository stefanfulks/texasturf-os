import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditInvoiceForm } from "./edit-form";
import type { Invoice, Vendor, Project } from "@/lib/database.types";

export default async function InvoiceEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "office"].includes(profile.role)) {
    redirect(`/invoices/${id}`);
  }

  const [invoiceRes, vendorsRes, projectsRes] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("vendors").select("id, name, type").eq("active", true).order("name"),
    supabase.from("projects").select("id, name, status").not("status", "in", '("complete","cancelled")').order("name"),
  ]);

  if (!invoiceRes.data) notFound();

  const invoice = invoiceRes.data as unknown as Invoice;
  const vendors  = (vendorsRes.data  ?? []) as Pick<Vendor,  "id" | "name" | "type">[];
  const projects = (projectsRes.data ?? []) as Pick<Project, "id" | "name" | "status">[];

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/invoices/${id}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
        ← Invoice
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Invoice</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {invoice.title} · all fields editable
        </p>
      </div>

      <EditInvoiceForm invoice={invoice} vendors={vendors} projects={projects} />
    </div>
  );
}
