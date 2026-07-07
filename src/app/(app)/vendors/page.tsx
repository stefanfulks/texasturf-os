import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VendorForm } from "./vendor-form";
import type { Vendor } from "@/lib/db-helpers.types";

const TYPE_LABELS: Record<string, string> = {
  installer:       "Installer",
  contractor_1099: "1099 Contractor",
  subcontractor:   "Subcontractor",
  supplier:        "Supplier",
  other:           "Other",
};

const TYPE_BADGE: Record<string, string> = {
  installer:       "bg-info-tint text-info",
  contractor_1099: "bg-info-tint text-info",
  subcontractor:   "bg-warn-tint text-warn",
  supplier:        "bg-sunken text-ink-2",
  other:           "bg-hover text-ink-3",
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
          <h1 className="page-title">Vendors & Contractors</h1>
          <p className="text-sm text-ink-3 mt-0.5">{active.length} active</p>
        </div>
      </div>

      {/* New vendor form */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold mb-4">Add Vendor</h2>
        <VendorForm mode="create" />
      </div>

      {/* Active vendors */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line bg-hover">
          <span className="text-xs font-semibold text-ink-2">Active</span>
          <span className="ml-2 text-xs text-ink-4">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-4">No vendors yet.</div>
        ) : (
          <div className="divide-y divide-line">
            {active.map((v) => {
              const counts = invoiceCounts[v.id];
              return (
                <Link
                  key={v.id}
                  href={`/vendors/${v.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-hover group transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink group-hover:underline">{v.name}</p>
                    {v.contact_name && <p className="text-xs text-ink-4">{v.contact_name}{v.email ? ` · ${v.email}` : ""}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {counts && (
                      <div className="text-right text-xs">
                        <p className="text-ink-2 font-medium">{counts.total} invoice{counts.total !== 1 ? "s" : ""}</p>
                        {counts.unpaid > 0 && <p className="text-warn">{counts.unpaid} open</p>}
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
        <div className="card overflow-hidden opacity-60">
          <div className="px-5 py-3 border-b border-line bg-hover">
            <span className="text-xs font-semibold text-ink-3">Inactive</span>
            <span className="ml-2 text-xs text-ink-4">{inactive.length}</span>
          </div>
          <div className="divide-y divide-line">
            {inactive.map((v) => (
              <Link key={v.id} href={`/vendors/${v.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-hover transition-colors">
                <p className="flex-1 text-sm text-ink-3">{v.name}</p>
                <span className="text-xs text-ink-4">{TYPE_LABELS[v.type]}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
