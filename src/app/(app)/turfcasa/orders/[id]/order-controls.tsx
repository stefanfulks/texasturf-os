"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban, Link2, MessageSquarePlus } from "lucide-react";
import { addOrderNote, setJobberInvoice, updateOrderStatus } from "../actions";
import {
  NEXT_STATUS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/lib/turfcasa/constants";

/** Warehouse controls: advance the status, cancel, drop a note, link the
 * Jobber invoice. Everything lands on the order's event trail. */
export function OrderControls({
  orderId,
  status,
  jobberInvoiceNumber,
}: {
  orderId: string;
  status: OrderStatus;
  jobberInvoiceNumber: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [invoice, setInvoice] = useState(jobberInvoiceNumber ?? "");

  const next = NEXT_STATUS[status];
  const cancellable = status !== "fulfilled" && status !== "cancelled";

  function run(fn: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {next ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => updateOrderStatus(orderId, next))}
            className="btn btn-primary disabled:opacity-60"
          >
            Mark {ORDER_STATUS_LABELS[next]} <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
        {cancellable ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Cancel this order?")) {
                run(() => updateOrderStatus(orderId, "cancelled"));
              }
            }}
            className="btn disabled:opacity-60"
          >
            <Ban className="h-4 w-4" /> Cancel order
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-52 flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-2">Add a note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field-input"
            placeholder="e.g. Customer picking up Friday morning"
          />
        </label>
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              const res = await addOrderNote(orderId, note);
              if (!res.error) setNote("");
              return res;
            })
          }
          className="btn disabled:opacity-60"
        >
          <MessageSquarePlus className="h-4 w-4" /> Note
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-52 flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-2">
            Jobber invoice # (billing stays in Jobber)
          </span>
          <input
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
            className="field-input num"
            placeholder="e.g. 3169"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setJobberInvoice(orderId, invoice))}
          className="btn disabled:opacity-60"
        >
          <Link2 className="h-4 w-4" /> Save link
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger-tint px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
