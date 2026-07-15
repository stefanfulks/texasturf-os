import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getDeal,
  getDealActivities,
  getContact,
  getJobberClientNames,
} from "@/lib/sales/queries";
import { SERVICE_LINE_LABELS, STAGE_LABELS } from "@/lib/sales/labels";
import { daysBetween, today } from "@/lib/sales/dates";
import { shortDate, usdFull } from "@/lib/sales/format";
import { Avatar } from "@/components/sales/Avatar";
import { StageTracker } from "@/components/sales/StageTracker";
import { StageTasks } from "@/components/sales/StageTasks";
import { ActivityTimeline } from "@/components/sales/ActivityTimeline";
import { RiskPanel } from "@/components/sales/RiskPanel";
import { JobberHandoff } from "@/components/sales/JobberHandoff";
import { DealHeaderActions } from "@/components/sales/DealHeaderActions";
import { DealOverviewForms } from "@/components/sales/DealOverviewForms";
import { DealComms } from "@/components/sales/DealComms";
import { listTags, getTagsForEntity } from "@/lib/tags/queries";
import { TagPicker } from "@/components/tags/TagPicker";
import { isTwilioConfigured, isSmsConfigured } from "@/lib/twilio/client";
import { isGmailConfigured } from "@/lib/google/gmail";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "warn" | "danger";
}) {
  const valueColor =
    tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="card p-4">
      <p className="eyebrow">{label}</p>
      <p className={`display mt-1.5 text-xl tabular-nums ${valueColor}`}>{value}</p>
      {sub ? <p className="mt-0.5 truncate text-xs text-ink-3">{sub}</p> : null}
    </div>
  );
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const deal = await getDeal(id);
  if (!deal) notFound();

  const activities = await getDealActivities(id);

  // Linked party: a prospect contact, or a Jobber client.
  const contact = deal.sales_contact_id
    ? await getContact(deal.sales_contact_id)
    : null;
  const jobberName = deal.jobber_client_id
    ? (await getJobberClientNames([deal.jobber_client_id]))[deal.jobber_client_id]
    : null;
  const partyName = contact?.name ?? jobberName ?? null;

  // Owner name + activity-author names from profiles.
  const profileIds = [
    ...new Set(
      [deal.owner_id, ...activities.map((a) => a.created_by)].filter(
        Boolean,
      ) as string[],
    ),
  ];
  const profileNames: Record<string, string> = {};
  if (profileIds.length) {
    const sb = await createClient();
    const { data } = await sb
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) profileNames[p.id] = p.full_name;
    }
  }
  const ownerName = deal.owner_id ? profileNames[deal.owner_id] : null;

  // Comms: capability flags are computed server-side so creds stay server-only;
  // the SMS + email threads are just the existing activity timeline filtered.
  const twilioConfigured = isTwilioConfigured();
  const smsConfigured = isSmsConfigured();
  const gmailConfigured = isGmailConfigured();
  const smsActivities = activities.filter((a) => a.kind === "sms");
  const emailActivities = activities.filter((a) => a.kind === "email");

  // Tags: full registry for autocomplete + what's applied to the deal/contact.
  const registryRows = await listTags();
  const registry = registryRows.map((t) => ({
    id: t.id, name: t.name, slug: t.slug, color: t.color,
  }));
  const dealTags = await getTagsForEntity("deal", id);
  const contactTags = deal.sales_contact_id
    ? await getTagsForEntity("sales_contact", deal.sales_contact_id)
    : [];

  const now = today();
  const open = deal.stage !== "closed_won" && deal.stage !== "closed_lost";
  const closeTone =
    open &&
    deal.expected_close_date &&
    daysBetween(deal.expected_close_date, now) > 0
      ? "danger"
      : "neutral";
  const nextStepTone =
    open && deal.stage !== "lead" && !deal.next_step ? "warn" : "neutral";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Breadcrumb */}
      <nav className="eyebrow flex items-center gap-1.5">
        <Link href="/sales" className="hover:text-ink">
          Sales
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-ink-2">{deal.name}</span>
      </nav>

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{deal.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[13px] text-ink-3">
            <span className="tabular-nums text-ink">{usdFull(deal.value_usd)}</span>
            {partyName ? (
              <>
                <span>·</span>
                <span>{partyName}</span>
              </>
            ) : null}
            {ownerName ? (
              <>
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  <Avatar name={ownerName} size="sm" />
                  {ownerName}
                </span>
              </>
            ) : null}
            {deal.service_line ? (
              <span className="chip chip-brand">
                {SERVICE_LINE_LABELS[deal.service_line]}
              </span>
            ) : null}
          </div>
        </div>
        {open ? (
          <DealHeaderActions deal={deal} />
        ) : (
          <span
            className={
              deal.stage === "closed_won" ? "chip chip-brand" : "chip chip-danger"
            }
          >
            {STAGE_LABELS[deal.stage]}
            {deal.closed_at ? ` · ${shortDate(deal.closed_at)}` : ""}
          </span>
        )}
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Amount"
          value={usdFull(deal.value_usd)}
          sub={deal.sqft ? `${deal.sqft.toLocaleString()} sq ft` : undefined}
        />
        <StatCard
          label="Close date"
          value={shortDate(deal.expected_close_date) || "—"}
          tone={closeTone}
        />
        <StatCard
          label="Days in stage"
          value={`${daysBetween(deal.stage_entered_at, now)}d`}
          sub={STAGE_LABELS[deal.stage]}
        />
        <StatCard
          label="Next step"
          value={deal.next_step_date ? shortDate(deal.next_step_date) : "—"}
          sub={deal.next_step ?? "none set"}
          tone={nextStepTone}
        />
      </div>

      <StageTracker deal={deal} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column: Overview + Activity */}
        <div className="space-y-3 lg:col-span-2">
          {open ? <StageTasks deal={deal} /> : null}

          <DealOverviewForms deal={deal} />

          {deal.notes ? (
            <div className="card px-4 py-3.5">
              <div className="eyebrow mb-1.5">Deal notes</div>
              <p className="text-[13px] leading-relaxed text-ink-2">{deal.notes}</p>
            </div>
          ) : null}

          <div className="panel">
            <div className="panel-head">
              <h2 className="text-sm font-semibold text-ink">Activity</h2>
              <span className="text-xs text-ink-4">{activities.length} total</span>
            </div>
            <div className="px-5 py-2">
              <ActivityTimeline activities={activities} ownerNames={profileNames} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {deal.stage === "closed_won" && !deal.jobber_client_id ? (
            <JobberHandoff
              dealId={deal.id}
              contact={
                contact
                  ? {
                      name: contact.name,
                      phone: contact.phone,
                      email: contact.email,
                      city: contact.city,
                    }
                  : null
              }
            />
          ) : null}

          <RiskPanel deal={deal} activities={activities} />

          <DealComms
            dealId={deal.id}
            contactId={deal.sales_contact_id}
            contactPhone={contact?.phone ?? null}
            contactEmail={contact?.email ?? null}
            smsActivities={smsActivities}
            emailActivities={emailActivities}
            twilioConfigured={twilioConfigured}
            smsConfigured={smsConfigured}
            gmailConfigured={gmailConfigured}
          />

          <div className="card p-4">
            <p className="eyebrow mb-2">Deal tags</p>
            <TagPicker
              entityType="deal"
              entityId={id}
              initialTags={dealTags}
              registry={registry}
            />
          </div>

          {deal.sales_contact_id ? (
            <div className="card p-4">
              <p className="eyebrow mb-2">Contact tags</p>
              <TagPicker
                entityType="sales_contact"
                entityId={deal.sales_contact_id}
                initialTags={contactTags}
                registry={registry}
              />
            </div>
          ) : null}

          <div className="card px-4 py-3.5">
            <div className="eyebrow mb-2.5">Details</div>
            <dl className="space-y-1.5 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-3">Created</dt>
                <dd className="text-ink">{shortDate(deal.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-3">Service line</dt>
                <dd className="text-ink">
                  {deal.service_line
                    ? SERVICE_LINE_LABELS[deal.service_line]
                    : "—"}
                </dd>
              </div>
              {deal.sqft ? (
                <div className="flex justify-between">
                  <dt className="text-ink-3">Area</dt>
                  <dd className="text-ink">{deal.sqft.toLocaleString()} sq ft</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-ink-3">Owner</dt>
                <dd className="text-ink">{ownerName ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
