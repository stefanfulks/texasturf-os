import Link from "next/link";
import type { Deal, Health } from "@/lib/sales/types";
import { SERVICE_LINE_LABELS } from "@/lib/sales/labels";
import { daysBetween, today } from "@/lib/sales/dates";
import { usd } from "@/lib/sales/format";
import { HealthDot } from "./HealthDot";
import { Avatar } from "./Avatar";

export function DealCard({
  deal,
  contactName,
  ownerName,
  health,
}: {
  deal: Deal;
  contactName?: string | null;
  ownerName?: string | null;
  health: Health;
}) {
  const age = daysBetween(deal.stage_entered_at, today());

  return (
    <Link
      href={`/sales/deals/${deal.id}`}
      className="card card-hover block space-y-2 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold leading-snug text-ink">
          {deal.name}
        </div>
        <HealthDot health={health} className="mt-1" />
      </div>
      {contactName ? (
        <div className="truncate text-xs text-ink-3">{contactName}</div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="display text-[17px] tabular-nums text-ink">
          {usd(deal.value_usd)}
        </span>
        {deal.service_line ? (
          <span className="chip chip-brand max-w-[120px] truncate">
            {SERVICE_LINE_LABELS[deal.service_line]}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-line pt-2">
        <span className="eyebrow">{age}d in stage</span>
        {ownerName ? <Avatar name={ownerName} size="sm" /> : null}
      </div>
    </Link>
  );
}
