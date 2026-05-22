import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "./review-form";
import type { Invoice, InvoiceLineItem, Vendor, Project } from "@/lib/database.types";

export default async function InvoiceReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin","office"].includes(profile.role)) redirect(`/invoices/${id}`);

  const [invoiceRes, lineItemsRes, vendorsRes, projectsRes] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_line_items").select("*").eq("invoice_id", id).order("sort_order"),
    supabase.from("vendors").select("id, name, type").eq("active", true).order("name"),
    supabase.from("projects").select("id, name, status").not("status", "in", '("complete","cancelled")').order("name"),
  ]);

  if (!invoiceRes.data) notFound();

  // Fetch vendor separately to avoid multi-FK TypeScript inference issue
  let vendorData: Vendor | null = null;
  const inv = invoiceRes.data as unknown as Invoice;
  if (inv.vendor_id) {
    const { data: vd } = await supabase.from("vendors").select("*").eq("id", inv.vendor_id).single();
    vendorData = vd as Vendor | null;
  }
  const invoice = { ...inv, vendor: vendorData } as Invoice & { vendor: Vendor | null };
  const lineItems = (lineItemsRes.data ?? []) as InvoiceLineItem[];
  const vendors   = (vendorsRes.data ?? []) as Pick<Vendor, "id" | "name" | "type">[];
  const projects  = (projectsRes.data ?? []) as Pick<Project, "id" | "name" | "status">[];

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`/invoices/${id}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">← Invoice</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review Invoice</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{invoice.title}</p>
      </div>

      {invoice.ocr_confidence != null && (
        <div className={`rounded-xl border px-5 py-3 text-sm ${invoice.ocr_confidence >= 85 ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          <strong>OCR Confidence: {invoice.ocr_confidence.toFixed(0)}%</strong>
          {invoice.ocr_confidence < 85 && " — Please verify extracted fields carefully."}
        </div>
      )}

      <ReviewForm
        invoice={invoice}
        lineItems={lineItems}
        vendors={vendors}
        projects={projects}
      />
    </div>
  );
}
