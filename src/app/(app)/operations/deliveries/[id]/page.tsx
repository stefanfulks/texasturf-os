import { notFound } from "next/navigation";
import Link from "next/link";
import { getDelivery } from "@/lib/warehouse/queries";
import { repostDeliveryToSlack } from "@/lib/warehouse/actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month:   "short",
    day:     "numeric",
    hour:    "numeric",
    minute:  "2-digit",
  });
}

export default async function DeliveryDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const d = await getDelivery(id);
  if (!d) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materials = (d.materials as any) ?? {};
  const turf      = materials.turf      ?? null;
  const dg        = materials.dg        ?? null;
  const infill    = materials.infill    ?? null;
  const fasteners = materials.fasteners ?? null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/operations/deliveries" className="text-xs text-ink-3 hover:text-ink">
            ← All deliveries
          </Link>
          <h1 className="mt-1 page-title">
            {d.client_name ?? "(no client)"}
          </h1>
          <p className="mt-0.5 text-sm text-ink-3 tabular-nums">
            Delivered {fmtDateTime(d.delivered_at)}
          </p>
          {d.address && (
            <p className="mt-0.5 text-sm text-ink-3">📍 {d.address}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {d.slack_message_ts ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-medium text-brand">
              ✓ Posted to Slack
            </span>
          ) : (
            <form action={repostDeliveryToSlack}>
              <input type="hidden" name="id" value={d.id} />
              <button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-strong">
                Post to Slack
              </button>
            </form>
          )}
          {d.slack_message_ts && (
            <form action={repostDeliveryToSlack}>
              <input type="hidden" name="id" value={d.id} />
              <button className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-hover">
                Repost
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ─── Receipt ───────────────────────────────────────────────── */}
      <Card title="Receipt">
        <Stat name="Received by"      value={d.received_by ?? "—"} />
        <Stat name="Staged at"        value={d.staging_location ?? "—"} />
        {d.slack_posted_at && (
          <Stat name="Slack posted at" value={fmtDateTime(d.slack_posted_at)} />
        )}
      </Card>

      {/* ─── Materials ─────────────────────────────────────────────── */}
      <Card title="Materials">
        {turf && (turf.product || turf.sqft != null || turf.batch) && (
          <Stat
            name="Turf"
            value={[
              turf.product,
              turf.sqft != null ? `${Number(turf.sqft).toLocaleString()} sqft` : null,
              turf.batch ? `batch ${turf.batch}` : null,
            ].filter(Boolean).join(" · ") || "—"}
          />
        )}
        {dg?.cubic_yards != null && (
          <Stat name="DG" value={`${dg.cubic_yards} cu yd`} />
        )}
        {infill && (infill.type || infill.bags != null) && (
          <Stat
            name="Infill"
            value={[infill.type, infill.bags != null ? `${infill.bags} bags` : null]
              .filter(Boolean).join(" · ") || "—"}
          />
        )}
        {fasteners && (fasteners.nails_boxes || fasteners.staples_boxes) && (
          <Stat
            name="Fasteners"
            value={[
              fasteners.nails_boxes   ? `${fasteners.nails_boxes} boxes nails` : null,
              fasteners.staples_boxes ? `${fasteners.staples_boxes} boxes staples` : null,
            ].filter(Boolean).join(" · ") || "—"}
          />
        )}
        {!turf && !dg && !infill && !fasteners && (
          <p className="text-sm text-ink-3">No materials recorded.</p>
        )}
      </Card>

      {/* ─── Photo ──────────────────────────────────────────────────── */}
      {d.photo_url && (
        <Card title="Photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={d.photo_url}
            alt="Delivery photo"
            className="max-h-96 rounded-lg border border-line"
          />
        </Card>
      )}

      {/* ─── Notes ──────────────────────────────────────────────────── */}
      {d.notes && (
        <Card title="Notes">
          <p className="whitespace-pre-wrap text-sm text-ink-2">{d.notes}</p>
        </Card>
      )}

      {/* ─── Linkage ────────────────────────────────────────────────── */}
      {d.pull_list_id && (
        <Card title="Linkage">
          <Link
            href={`/operations/pull-lists/${d.pull_list_id}`}
            className="text-sm text-ink-2 underline-offset-2 hover:underline"
          >
            View pull list →
          </Link>
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 space-y-3">
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
