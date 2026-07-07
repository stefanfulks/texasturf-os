import { notFound } from "next/navigation";
import Link from "next/link";
import { getPullList, getPullListRolls } from "@/lib/warehouse/queries";
import { updatePullListStatus, signOffPullList } from "@/lib/warehouse/actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const FLOW = ["draft", "pulled", "staged", "dispatched", "delivered"] as const;

const STATUS_TONE: Record<string, string> = {
  draft:      "bg-sunken text-ink-2",
  pulled:     "bg-warn-tint text-warn",
  staged:     "bg-info-tint text-info",
  dispatched: "bg-info-tint text-info",
  delivered:  "bg-brand-tint text-brand",
};

export default async function PullListDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const [pl, rolls] = await Promise.all([getPullList(id), getPullListRolls(id)]);
  if (!pl) notFound();

  const flowIdx = FLOW.indexOf(pl.status);
  const prev = flowIdx > 0 ? FLOW[flowIdx - 1] : null;
  const next = flowIdx >= 0 && flowIdx < FLOW.length - 1 ? FLOW[flowIdx + 1] : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/operations/pull-lists" className="text-xs text-ink-3 hover:text-ink">
            ← All pull lists
          </Link>
          <h1 className="mt-1 page-title">
            {pl.client_name ?? "(no client)"}
            {pl.job_number && <span className="ml-2 text-ink-4">#{pl.job_number}</span>}
          </h1>
          <p className="mt-0.5 text-sm text-ink-3 tabular-nums">{pl.job_date}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={"inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize " + (STATUS_TONE[pl.status] ?? "bg-sunken text-ink-2")}>
            {pl.status}
          </span>
          {prev && (
            <form action={updatePullListStatus}>
              <input type="hidden" name="id" value={pl.id} />
              <input type="hidden" name="status" value={prev} />
              <button className="rounded-lg border border-line bg-white px-3 py-1 text-xs font-medium text-ink-2 hover:bg-hover">
                ← {cap(prev)}
              </button>
            </form>
          )}
          {next && (
            <form action={updatePullListStatus}>
              <input type="hidden" name="id" value={pl.id} />
              <input type="hidden" name="status" value={next} />
              <button className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-strong">
                Mark {cap(next)} →
              </button>
            </form>
          )}
          {(pl.status === "dispatched" || pl.status === "delivered") && (
            <Link
              href={`/operations/deliveries/new?pull_list_id=${pl.id}`}
              className="rounded-lg border border-line bg-white px-3 py-1 text-xs font-medium text-ink-2 hover:bg-hover"
            >
              + Log delivery
            </Link>
          )}
        </div>
      </div>

      {/* ─── Crew ───────────────────────────────────────────────────── */}
      <Card title="Crew">
        <Stat name="Crew lead" value={pl.crew_lead ?? "—"} />
        <Stat name="Driver"    value={pl.driver    ?? "—"} />
        <Stat name="Stager"    value={pl.stager    ?? "—"} />
      </Card>

      {/* ─── Sign-offs ──────────────────────────────────────────────── */}
      <Card title="Sign-offs">
        <SignOffRow id={pl.id} role="stager" signedBy={pl.stager_signed_by} signedAt={pl.stager_signed_at} />
        <SignOffRow id={pl.id} role="driver" signedBy={pl.driver_signed_by} signedAt={pl.driver_signed_at} />
        <SignOffRow id={pl.id} role="lead"   signedBy={pl.lead_signed_by}   signedAt={pl.lead_signed_at}   />
      </Card>

      {/* ─── Turf ───────────────────────────────────────────────────── */}
      <Card title="Turf">
        <Stat name="Product"      value={pl.turf_product ?? "—"} />
        <Stat name="Batch number" value={pl.turf_batch_number ?? "—"} />
        <Stat name="Linear runs"  value={pl.turf_linear_runs ?? "—"} />
        <Stat name="Total sqft"   value={pl.turf_total_sqft ?? "—"} />
      </Card>

      {/* ─── Rolls ──────────────────────────────────────────────────── */}
      <Card title={`Rolls (${rolls.length})`}>
        {rolls.length === 0 ? (
          <p className="text-sm text-ink-3">No rolls listed.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-3">
              <tr><th className="text-left pb-2">Roll #</th><th className="text-left pb-2">Lengths</th></tr>
            </thead>
            <tbody>
              {rolls.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1.5 font-medium">{r.roll_number}</td>
                  <td className="py-1.5 text-ink-2">{r.lengths_needed ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ─── Loose materials ───────────────────────────────────────── */}
      <Card title="Loose materials">
        <Stat name="Warehouse"      value={pl.loose_warehouse ?? "—"} />
        <Stat name="Yard — delivery" value={pl.loose_yard_delivery ?? "—"} />
        <Stat name="Yard — pickup"   value={pl.loose_yard_pickup ?? "—"} />
      </Card>

      {/* ─── Bagged ─────────────────────────────────────────────────── */}
      <Card title="Bagged products">
        {pl.bagged_none ? (
          <p className="text-sm text-ink-3">None on this job.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat name="Standard sand" value={pl.bagged_standard_sand} />
            <Stat name="Fine sand"     value={pl.bagged_fine_sand} />
            <Stat name="Wonderfill"    value={pl.bagged_wonderfill} />
            <Stat name="Misc"          value={pl.bagged_misc} />
          </div>
        )}
      </Card>

      {/* ─── Fasteners ──────────────────────────────────────────────── */}
      <Card title="Fasteners & supplies">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat name="Nails (boxes)"     value={pl.nails_boxes} />
          <Stat name="Staples (boxes)"   value={pl.staples_boxes} />
          <Stat name="Glue (gal)"        value={pl.glue_gal} />
          <Stat name="Seam tape (rolls)" value={pl.seam_tape_rolls} />
        </div>
        {pl.weed_barrier && (
          <Stat name="Weed barrier" value={pl.weed_barrier} />
        )}
      </Card>

      {pl.notes && (
        <Card title="Notes">
          <p className="whitespace-pre-wrap text-sm text-ink-2">{pl.notes}</p>
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

function SignOffRow({
  id,
  role,
  signedBy,
  signedAt,
}: {
  id: string;
  role: "stager" | "driver" | "lead";
  signedBy: string | null;
  signedAt: string | null;
}) {
  const signed = !!signedAt;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div>
        <div className="text-xs text-ink-3 capitalize">{role}</div>
        {signed ? (
          <div className="font-medium text-ink">
            ✓ {signedBy ?? "Signed"}
            {signedAt && <span className="ml-1 text-xs text-ink-3">· {fmtDateTime(signedAt)}</span>}
          </div>
        ) : (
          <div className="text-ink-3">Not yet signed</div>
        )}
      </div>
      {!signed && (
        <form action={signOffPullList}>
          <input type="hidden" name="id"   value={id} />
          <input type="hidden" name="role" value={role} />
          <button className="rounded-lg border border-line bg-white px-3 py-1 text-xs font-medium text-ink-2 hover:bg-hover">
            I&apos;m the {role} — sign off
          </button>
        </form>
      )}
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month:  "short",
    day:    "numeric",
    hour:   "numeric",
    minute: "2-digit",
  });
}
