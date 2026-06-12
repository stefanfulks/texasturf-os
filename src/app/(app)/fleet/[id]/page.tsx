import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditForm } from "./edit-form";
import { AssetArchiveButton } from "./archive-button";
import type { Asset } from "@/lib/db-helpers.types";

const UNIT_LABELS: Record<Asset["unit_type"], string> = {
  truck: "Truck",
  trailer: "Trailer",
  heavy_equipment: "Heavy Equipment",
  tool: "Tool",
};

const STATUS_COLORS: Record<Asset["status"], string> = {
  available: "bg-brand-tint text-brand",
  assigned_to_job: "bg-info-tint text-info",
  in_use_today: "bg-warn-tint text-warn",
  maintenance_needed: "bg-warn-tint text-warn",
  out_of_service: "bg-danger-tint text-danger",
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

  // Auth + role for showing the archive button
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isOfficeOrAdmin = ["admin", "office"].includes((profile as { role?: string } | null)?.role ?? "");
  // `archived` is added by migration 20260530300000 — defaults to false until applied.
  const archived = (asset as unknown as { archived?: boolean }).archived === true;

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
          className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
        >
          <span>←</span>
          <span>Fleet</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
          <p className="mt-1 text-sm text-ink-3">{UNIT_LABELS[asset.unit_type]}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          {archived && (
            <span className="rounded-full bg-sunken px-3 py-1 text-xs font-medium text-ink-3">
              Archived
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[asset.status]}`}
          >
            {STATUS_LABELS[asset.status]}
          </span>
          {isOfficeOrAdmin && (
            <AssetArchiveButton assetId={asset.id} archived={archived} />
          )}
        </div>
      </div>

      {/* Edit form */}
      <div className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-sm font-medium text-ink mb-5">Details</h2>
        <EditForm asset={asset as Asset} />
      </div>

      {/* Rig Chain */}
      <div className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-sm font-medium text-ink mb-4">Rig Chain</h2>

        {!parent && (!children || children.length === 0) ? (
          <p className="text-sm text-ink-4">No rig attachments.</p>
        ) : (
          <div className="space-y-3">
            {parent && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-ink-4">Attached to</span>
                <Link
                  href={`/fleet/${parent.id}`}
                  className="font-medium text-ink hover:underline"
                >
                  {parent.name}
                </Link>
                <span className="text-ink-4">{UNIT_LABELS[parent.unit_type as Asset["unit_type"]]}</span>
              </div>
            )}

            {children && children.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-ink-4">
                  Attached to this unit
                </p>
                {children.map((child) => (
                  <div key={child.id} className="flex items-center gap-3 text-sm">
                    <span className="text-ink-4">↳</span>
                    <Link
                      href={`/fleet/${child.id}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {child.name}
                    </Link>
                    <span className="text-ink-4">{UNIT_LABELS[child.unit_type]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-ink-4 space-y-1 pb-4">
        {asset.monday_item_id && (
          <p>Monday ID: {asset.monday_item_id}</p>
        )}
        <p>Created: {new Date(asset.created_at).toLocaleDateString()}</p>
        <p>Last updated: {new Date(asset.updated_at).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
