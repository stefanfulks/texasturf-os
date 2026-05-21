import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditForm } from "./edit-form";
import type { Asset } from "@/lib/database.types";

const UNIT_LABELS: Record<Asset["unit_type"], string> = {
  truck: "Truck",
  trailer: "Trailer",
  heavy_equipment: "Heavy Equipment",
};

const STATUS_COLORS: Record<Asset["status"], string> = {
  available: "bg-green-100 text-green-800",
  assigned_to_job: "bg-blue-100 text-blue-800",
  in_use_today: "bg-amber-100 text-amber-800",
  maintenance_needed: "bg-orange-100 text-orange-800",
  out_of_service: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<Asset["status"], string> = {
  available: "Available",
  assigned_to_job: "Assigned to Job",
  in_use_today: "In Use Today",
  maintenance_needed: "Maintenance Needed",
  out_of_service: "Out of Service",
};

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Load asset + its parent (what it's attached to)
  const { data: asset } = await supabase
    .from("assets")
    .select("*, parent:attached_to_id(id, name, unit_type)")
    .eq("id", id)
    .single();

  if (!asset) notFound();

  // Load children (assets attached to this one, e.g. trailer hooked to this truck)
  const { data: children } = await supabase
    .from("assets")
    .select("id, name, unit_type, status")
    .eq("attached_to_id", id);

  const parent = asset.parent as Pick<Asset, "id" | "name" | "unit_type"> | null;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Back nav */}
      <div>
        <Link
          href="/fleet"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <span>←</span>
          <span>Fleet</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">{UNIT_LABELS[asset.unit_type]}</p>
        </div>
        <span
          className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[asset.status]}`}
        >
          {STATUS_LABELS[asset.status]}
        </span>
      </div>

      {/* Edit form */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-medium text-zinc-900 mb-5">Details</h2>
        <EditForm asset={asset as Asset} />
      </div>

      {/* Rig Chain */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-medium text-zinc-900 mb-4">Rig Chain</h2>

        {!parent && (!children || children.length === 0) ? (
          <p className="text-sm text-zinc-400">No rig attachments.</p>
        ) : (
          <div className="space-y-3">
            {parent && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400">Attached to</span>
                <Link
                  href={`/fleet/${parent.id}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {parent.name}
                </Link>
                <span className="text-zinc-400">{UNIT_LABELS[parent.unit_type as Asset["unit_type"]]}</span>
              </div>
            )}

            {children && children.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Attached to this unit
                </p>
                {children.map((child) => (
                  <div key={child.id} className="flex items-center gap-3 text-sm">
                    <span className="text-zinc-400">↳</span>
                    <Link
                      href={`/fleet/${child.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {child.name}
                    </Link>
                    <span className="text-zinc-400">{UNIT_LABELS[child.unit_type]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-zinc-400 space-y-1 pb-4">
        {asset.monday_item_id && (
          <p>Monday ID: {asset.monday_item_id}</p>
        )}
        <p>Created: {new Date(asset.created_at).toLocaleDateString()}</p>
        <p>Last updated: {new Date(asset.updated_at).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
