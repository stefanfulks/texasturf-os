import Link from "next/link";
import { JobForm } from "../job-form";
import { redirectIfNotOfficeOrAdmin } from "../../_lib/require-role";

export default async function NewJobPage() {
  await redirectIfNotOfficeOrAdmin();
  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/inventory/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        ← Jobs
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Job</h1>
        <p className="text-sm text-ink-3 mt-0.5">Create a new job before adding allocations.</p>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <JobForm mode="create" />
      </div>
    </div>
  );
}
