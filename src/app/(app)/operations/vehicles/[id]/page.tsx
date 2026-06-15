import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

type LogDetail = {
  id: string;
  asset_id: string;
  schedule_id: string | null;
  performed_at: string;
  description: string;
  cost_cents: number;
  meter_value: number | null;
  vendor: string | null;
  performed_by_vendor: string | null;
  performed_by_profile: string | null;
  invoice_url: string | null;
  notes: string | null;
  created_at: string;
  asset: { name: string; unit_type: string; identifier: string | null } | null;
  schedule: { name: string; interval_type: string } | null;
  performer: { full_name: string | null; email: string | null } | null;
};

function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month:   "long",
    day:     "numeric",
    year:    "numeric",
  });
}

export default async function MaintenanceDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const sb = await createClient();
  const { data, error } = await sb
    .from("maintenance_logs")
    .select(
      "id, asset_id, schedule_id, performed_at, description, cost_cents, meter_value, " +
      "vendor, performed_by_vendor, performed_by_profile, invoice_url, notes, created_at, " +
      "asset:asset_id(name, unit_type, identifier), " +
      "schedule:schedule_id(name, interval_type), " +
      "performer:performed_by_profile(full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();

  const log = data as unknown as LogDetail;
  const performer =
    log.performer?.full_name?.trim()
    || log.performer?.email?.split("@")[0]
    || null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/operations/vehicles" className="text-xs text-ink-3 hover:text-ink">
          ← All maintenance
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{log.description}</h1>
        <p className="mt-0.5 text-sm text-ink-3">{fmtDate(log.performed_at)}</p>
      </div>

      <Card title="Vehicle">
        <Stat name="Name" value={log.asset?.name ?? "—"} />
        <Stat
          name="Unit type"
          value={log.asset?.unit_type ? log.asset.unit_type.replace("_", " ") : "—"}
        />
        {log.asset?.identifier && (
          <Stat name="Identifier" value={log.asset.identifier} />
        )}
        {log.asset_id && (
          <Stat
            name=""
            value={
              <Link
                href={`/operations/vehicles?asset=${log.asset_id}`}
                className="text-xs text-ink-2 hover:text-ink underline-offset-2 hover:underline"
              >
                View all logs for this vehicle →
              </Link>
            }
          />
        )}
      </Card>

      <Card title="Service">
        <Stat name="Cost"        value={fmtUSD(log.cost_cents)} />
        <Stat name="Vendor"      value={log.vendor ?? log.performed_by_vendor ?? "—"} />
        <Stat name="Odometer / hours" value={log.meter_value ?? "—"} />
        {performer && <Stat name="Logged by" value={performer} />}
        {log.schedule && (
          <Stat
            name="Linked schedule"
            value={`${log.schedule.name} (${log.schedule.interval_type})`}
          />
        )}
      </Card>

      {log.invoice_url && (
        <Card title="Invoice">
          <a
            href={log.invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink-2 underline-offset-2 hover:underline break-all"
          >
            {log.invoice_url}
          </a>
        </Card>
      )}

      {log.notes && (
        <Card title="Notes">
          <p className="whitespace-pre-wrap text-sm text-ink-2">{log.notes}</p>
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-ink-3">{name}</span>
      <span className="font-medium text-ink text-right">{value}</span>
    </div>
  );
}
