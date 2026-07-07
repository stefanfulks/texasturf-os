import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrderWithEvents, getLookups, nameMaps, signPoDocs } from "../_lib/queries";
import { stageLabel, poNumber, fmtDate, PRIORITY_META } from "../_lib/status";
import { StatusControl } from "./status-control";
import { EditForm } from "./edit-form";
import { DocumentsSection } from "./documents-section";
import type { PoDocument } from "@/lib/db-helpers.types";

export const dynamic = "force-dynamic";

export default async function VendorOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const canEdit = !!profile && ["admin", "office"].includes(profile.role);

  const [{ order, events }, lookups] = await Promise.all([
    getOrderWithEvents(supabase, id),
    getLookups(supabase),
  ]);
  if (!order) notFound();

  const { profile: profileMap, vendor: vendorMap } = nameMaps(lookups);
  const buyers = lookups.profiles.filter((p) => ["admin", "office"].includes(p.role));

  const docs = (Array.isArray(order.documents) ? order.documents : []) as unknown as PoDocument[];
  const signed = await signPoDocs(docs.map((d) => d.path));
  const urls: Record<string, string> = {};
  for (const [k, v] of signed) urls[k] = v;

  const pr = PRIORITY_META[order.priority];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/operations/vendor-orders" className="text-sm text-ink-3 hover:underline">← Vendor Orders</Link>
        <div className="mt-1 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-ink-4">{poNumber(order.seq)}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pr.badge}`}>{pr.label}</span>
            </div>
            <h1 className="mt-0.5 page-title">
              {order.material_needed || order.request_description}
            </h1>
          </div>
          <StatusControl id={order.id} current={order.status} canEdit={canEdit} />
        </div>
      </div>

      {/* Quick meta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Meta label="Buyer" value={order.assigned_buyer_id ? profileMap.get(order.assigned_buyer_id) ?? "—" : "Unassigned"} />
        <Meta label="Vendor" value={order.vendor_id ? vendorMap.get(order.vendor_id) ?? "—" : "—"} />
        <Meta label="Requested" value={fmtDate(order.request_date)} />
        <Meta label="Needed by" value={fmtDate(order.needed_by)} />
      </div>

      {!canEdit && (
        <p className="text-xs text-ink-4 bg-sunken rounded-lg px-3 py-2">
          Read-only — only office/admin can edit purchase details. Status: {stageLabel(order.status)}.
        </p>
      )}

      {/* Editable detail */}
      <div className="card p-6">
        <EditForm order={order} buyers={buyers} vendors={lookups.vendors} projects={lookups.projects} canEdit={canEdit} />
      </div>

      {/* Documents */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-ink mb-4">Documents</h2>
        <DocumentsSection id={order.id} docs={docs} urls={urls} canEdit={canEdit} />
      </div>

      {/* History */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-ink mb-4">History</h2>
        {events.length === 0 ? (
          <p className="text-sm text-ink-4">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-4" />
                <div className="min-w-0">
                  <p className="text-ink-2">
                    {e.previous_status && e.new_status
                      ? <>{stageLabel(e.previous_status)} → <span className="font-medium text-ink">{stageLabel(e.new_status)}</span></>
                      : e.new_status
                        ? <span className="font-medium text-ink">{stageLabel(e.new_status)}</span>
                        : (e.notes ?? "Updated")}
                  </p>
                  {e.notes && (e.previous_status || e.new_status) && <p className="text-xs text-ink-4">{e.notes}</p>}
                  <p className="text-[11px] text-ink-4">
                    {new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {e.changed_by_id ? ` · ${profileMap.get(e.changed_by_id) ?? "system"}` : e.source === "cron" ? " · system" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2">
      <div className="text-[11px] text-ink-4">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-ink-2 truncate">{value}</div>
    </div>
  );
}
