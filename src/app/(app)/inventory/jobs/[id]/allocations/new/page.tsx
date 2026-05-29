import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAllocation } from "../../../actions";
import { AllocationForm } from "./allocation-form";
import type { InvJob, InvProduct } from "@/lib/database.types";

export default async function NewAllocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [jobRes, productsRes] = await Promise.all([
    supabase.from("inv_jobs").select("id, job_number, job_name").eq("id", id).single(),
    supabase.from("inv_products").select("id, name, width_ft").eq("active", true).order("name"),
  ]);

  if (!jobRes.data) notFound();
  const job      = jobRes.data as Pick<InvJob, "id" | "job_number" | "job_name">;
  const products = (productsRes.data ?? []) as Pick<InvProduct, "id" | "name" | "width_ft">[];

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/inventory/jobs/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← {job.job_number ? `${job.job_number} · ` : ""}{job.job_name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Allocation</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Request material for this job. You can assign a roll afterwards.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <AllocationForm jobId={id} products={products} action={createAllocation} />
      </div>
    </div>
  );
}
