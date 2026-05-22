import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VendorForm } from "./vendor-form";
import type { Vendor } from "@/lib/database.types";

const TYPE_LABELS: Record<string, string> = {
  installer:       "Installer",
  contractor_1099: "1099 Contractor",
  subcontractor:   "Subcontractor",
  supplier:        "Supplier",
  other:           "Other",
};

const TYPE_BADGE: Record<string, string> = {
  installer:       "bg-blue-50 text-blue-700",
  contractor_1099: "bg-purple-50 text-purple-700",
  subcontractor:   "bg-amber-50 text-amber-700",
  supplier:        "bg-zinc-100 text-zinc-600",
  other:           "bg-zinc-50 text-zinc-500",
};

export default async function VendorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [vendorsRes, invoiceCountRes] = await Promise.all([
    supabase.from("vendors").select("*").order("name"),
    supabase.from("invoices").select("vendor_id, status"),
  ]);

  const vendors = (vendorsRes.data ?? []) as Vendor[];

  // Build invoice count per vendor
  const invoiceCounts: Record<string, { total: number; unpaid: number }> = {};
  for (const inv of invoiceCountRes.data ?? []) {
    if (!inv.vendor_id) continue;
    if (!invoiceCounts[inv.vendor_id]) invoiceCounts[inv.vendor_id] = { total: 0, unpaid: 0 };
    invoiceCounts[inv.vendor_id].total++;
    if (!["paid","archived"].includes(inv.status)) invoiceCounts[inv.vendor_id].unpaid++;
  }

  const active  = vendors.filter((v) => v.active);
  const inactive = vendors.filter((v) => !v.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors & Contractors</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{active.length} active</p>
        </div>
      </div>

      {/* New vendor form */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold mb-4">Add Vendor</h2>
        <VendorForm mode="create" />
      </div>

      {/* Active vendors */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
          <span className="text-xs font-semibold text-zinc-600">Active</span>
          <span className="ml-2 text-xs text-zinc-400">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">No vendors yet.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {active.map((v) => {
              const counts = invoiceCounts[v.id];
              return (
                <Link
                  key={v.id}
                  href={`/vendors/${v.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 group transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 group-hover:underline">{v.name}</p>
                    {v.contact_name && <p className="text-xs text-zinc-400">{v.contact_name}{v.email ? ` · ${v.email}` : ""}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {counts && (
                      <div className="text-right text-xs">
                        <p className="text-zinc-700 font-medium">{counts.total} invoice{counts.total !== 1 ? "s" : ""}</p>
                        {counts.unpaid > 0 && <p className="text-amber-600">{counts.unpaid} open</p>}
                      </div>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_BADGE[v.type]}`}>
                      {TYPE_LABELS[v.type]}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden opacity-60">
          <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
            <span className="text-xs font-semibold text-zinc-500">Inactive</span>
            <span className="ml-2 text-xs text-zinc-400">{inactive.length}</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {inactive.map((v) => (
              <Link key={v.id} href={`/vendors/${v.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50 transition-colors">
                <p className="flex-1 text-sm text-zinc-500">{v.name}</p>
                <span className="text-xs text-zinc-400">{TYPE_LABELS[v.type]}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
