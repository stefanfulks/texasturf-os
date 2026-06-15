"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import type { Deal, Health } from "@/lib/sales/types";
import { OPEN_STAGES, SERVICE_LINE_LABELS, STAGE_LABELS } from "@/lib/sales/labels";
import { daysBetween, today } from "@/lib/sales/dates";
import { shortDate, usdFull } from "@/lib/sales/format";
import { cn } from "@/lib/utils";
import { HealthDot } from "./HealthDot";
import { Avatar } from "./Avatar";

type SortKey = "value" | "stage" | "age" | "close";

export function DealTable({
  deals,
  contactNames = {},
  ownerNames = {},
  healthById = {},
}: {
  deals: Deal[];
  contactNames?: Record<string, string>;
  ownerNames?: Record<string, string>;
  healthById?: Record<string, Health>;
}) {
  const [sort, setSort] = useState<SortKey>("value");
  const [dir, setDir] = useState<1 | -1>(-1);
  const now = today();

  const open = deals.filter(
    (d) => d.stage !== "closed_won" && d.stage !== "closed_lost",
  );
  const sorted = [...open].sort((a, b) => {
    const v =
      sort === "value"
        ? (a.value_usd ?? 0) - (b.value_usd ?? 0)
        : sort === "stage"
          ? OPEN_STAGES.indexOf(a.stage) - OPEN_STAGES.indexOf(b.stage)
          : sort === "age"
            ? daysBetween(b.stage_entered_at, now) -
              daysBetween(a.stage_entered_at, now)
            : (a.expected_close_date ?? "").localeCompare(
                b.expected_close_date ?? "",
              );
    return v * dir;
  });

  const header = (key: SortKey, label: string) => (
    <button
      onClick={() => {
        if (sort === key) setDir((d) => (d === 1 ? -1 : 1));
        else {
          setSort(key);
          setDir(-1);
        }
      }}
      className="eyebrow inline-flex items-center gap-1 hover:text-ink"
    >
      {label}
      <ArrowUpDown
        className={cn("size-2.5", sort === key ? "text-brand" : "opacity-40")}
      />
    </button>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line bg-sunken text-left">
            <th className="px-4 py-2.5">
              <span className="eyebrow">Deal</span>
            </th>
            <th className="px-3 py-2.5">{header("value", "Value")}</th>
            <th className="px-3 py-2.5">{header("stage", "Stage")}</th>
            <th className="px-3 py-2.5">
              <span className="eyebrow">Service</span>
            </th>
            <th className="px-3 py-2.5">{header("age", "In stage")}</th>
            <th className="px-3 py-2.5">{header("close", "Close")}</th>
            <th className="px-3 py-2.5">
              <span className="eyebrow">Owner</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr
              key={d.id}
              className="row-link border-t border-line last:border-0"
            >
              <td className="px-4 py-2.5">
                <Link
                  href={`/sales/deals/${d.id}`}
                  className="flex items-center gap-2 font-medium text-ink hover:text-brand"
                >
                  <HealthDot health={healthById[d.id] ?? "green"} />
                  <span>
                    {d.name}
                    {contactNames[d.id] ? (
                      <span className="ml-2 text-xs text-ink-3">
                        {contactNames[d.id]}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-ink">
                {usdFull(d.value_usd)}
              </td>
              <td className="px-3 py-2.5">
                <span className="chip chip-neutral">{STAGE_LABELS[d.stage]}</span>
              </td>
              <td className="px-3 py-2.5 text-ink-3">
                {d.service_line ? SERVICE_LINE_LABELS[d.service_line] : "—"}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-xs text-ink-2">
                {daysBetween(d.stage_entered_at, now)}d
              </td>
              <td className="px-3 py-2.5 text-ink-3">
                {shortDate(d.expected_close_date) || "—"}
              </td>
              <td className="px-3 py-2.5">
                {d.owner_id && ownerNames[d.owner_id] ? (
                  <Avatar name={ownerNames[d.owner_id]} size="sm" />
                ) : (
                  <span className="text-ink-4">—</span>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-ink-3">
                No open deals.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
