import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReturnsClient } from "./returns-client";
import type { InvJob, InvRoll, InvProduct } from "@/lib/database.types";

const ACTIVE_JOB_STATUSES = ["in_progress", "staged", "completed"];

export default async function InventoryReturnsPage({
  searchParams,
}: {
  searchParams?: Promise<{ job?: string }>;
}) {
  const supabase = await createClient();
  const params = (await searchParams) ?? {};
  const selectedJobId = params.job ?? "";

  const [jobsResult, productsResult, pendingCountResult] = await Promise.all([
    supabase
      .from("inv_jobs")
      .select("id, job_number, job_name, status")
      .in("status", ACTIVE_JOB_STATUSES)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("inv_products")
      .select("id, name, sku, width_ft")
      .eq("active", true)
      .order("name"),
    supabase
      .from("inv_rolls")
      .select("id", { count: "exact", head: true })
      .eq("status", "returned"),
  ]);

  const jobs = (jobsResult.data ?? []) as unknown as Pick<
    InvJob,
    "id" | "job_number" | "job_name" | "status"
  >[];
  const products = (productsResult.data ?? []) as unknown as Pick<
    InvProduct,
    "id" | "name" | "sku" | "width_ft"
  >[];
  const pendingCount = pendingCountResult.count ?? 0;

  // If a job is selected, fetch its allocated rolls
  let jobRolls: Pick<
    InvRoll,
    | "id"
    | "tt_sku_tag_number"
    | "product_name"
    | "current_length_ft"
    | "width_ft"
    | "dye_lot"
    | "status"
  >[] = [];
  if (selectedJobId) {
    const { data } = await supabase
      .from("inv_rolls")
      .select(
        "id, tt_sku_tag_number, product_name, current_length_ft, width_ft, dye_lot, status",
      )
      .eq("allocated_job_id", selectedJobId)
      .in("status", ["allocated", "staged", "dispatched"]);

    jobRolls = (data ?? []) as unknown as typeof jobRolls;
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Process Returns</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Receive rolls back from a job, or log an unmarked return when the job source is
            unknown.
          </p>
        </div>
        <Link
          href="/inventory/returns/pending"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <ClipboardList className="w-4 h-4" aria-hidden="true" />
          Pending review
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-orange-100 text-orange-800 text-xs font-semibold">
              {pendingCount}
            </span>
          )}
        </Link>
      </div>

      <ReturnsClient
        jobs={jobs}
        products={products}
        selectedJob={selectedJob}
        jobRolls={jobRolls}
      />
    </div>
  );
}
