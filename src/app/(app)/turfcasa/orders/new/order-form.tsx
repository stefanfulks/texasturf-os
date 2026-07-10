"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createOrder, type OrderFormState } from "../actions";
import {
  FULFILLMENT_LABELS,
  PRODUCT_UNIT_LABELS,
} from "@/lib/turfcasa/constants";

type CatalogProduct = {
  id: string;
  name: string;
  unit: string;
  retail_price: number | null;
  trade_price: number | null;
};

type Line = {
  product_id: string | null;
  name: string;
  qty: string;
  unit: string;
  unit_price: string;
};

const EMPTY_LINE: Line = { product_id: null, name: "", qty: "1", unit: "each", unit_price: "" };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function OrderForm({ products }: { products: CatalogProduct[] }) {
  const [state, formAction, pending] = useActionState<OrderFormState, FormData>(
    createOrder,
    { error: null, success: false },
  );
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [isTrade, setIsTrade] = useState(false);
  const [fulfillment, setFulfillment] = useState<"will_call" | "delivery">("will_call");

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) {
      setLine(i, { product_id: null });
      return;
    }
    // Trade accounts get the trade price when one is set; blank price still
    // means "type it in" — we never invent numbers.
    const price = isTrade ? (p.trade_price ?? p.retail_price) : p.retail_price;
    setLine(i, {
      product_id: p.id,
      name: p.name,
      unit: p.unit,
      unit_price: price != null ? String(price) : "",
    });
  }

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const qty = parseFloat(l.qty);
        const price = parseFloat(l.unit_price);
        return sum + (isFinite(qty) && isFinite(price) ? qty * price : 0);
      }, 0),
    [lines],
  );

  const linesPayload = JSON.stringify(
    lines
      .filter((l) => l.name.trim())
      .map((l, i) => ({
        product_id: l.product_id,
        name: l.name.trim(),
        qty: parseFloat(l.qty) || 1,
        unit: l.unit,
        unit_price: l.unit_price === "" ? null : parseFloat(l.unit_price),
        sort_order: i,
      })),
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="lines" value={linesPayload} />

      <div className="panel p-5 space-y-4">
        <p className="eyebrow">Customer</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Name *</span>
            <input name="customer_name" required className="field-input" placeholder="Customer name" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Company</span>
            <input name="company" className="field-input" placeholder="Company (for trade accounts)" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Phone</span>
            <input name="customer_phone" className="field-input" placeholder="(512) …" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Email</span>
            <input name="customer_email" type="email" className="field-input" placeholder="name@company.com" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              name="is_trade"
              checked={isTrade}
              onChange={(e) => setIsTrade(e.target.checked)}
            />
            Trade account (uses trade pricing)
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            Source
            <select name="source" className="field-input !w-auto" defaultValue="phone">
              <option value="phone">Phone</option>
              <option value="walk_in">Walk-in</option>
            </select>
          </label>
        </div>
      </div>

      <div className="panel p-5 space-y-3">
        <p className="eyebrow">Line items</p>
        {lines.map((l, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <label className="block min-w-40 flex-1">
              <span className="mb-1 block text-xs font-medium text-ink-2">Product</span>
              <select
                value={l.product_id ?? ""}
                onChange={(e) => pickProduct(i, e.target.value)}
                className="field-input"
              >
                <option value="">Custom line…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block min-w-40 flex-1">
              <span className="mb-1 block text-xs font-medium text-ink-2">Description</span>
              <input
                value={l.name}
                onChange={(e) => setLine(i, { name: e.target.value })}
                className="field-input"
                placeholder="Line description"
              />
            </label>
            <label className="block w-20">
              <span className="mb-1 block text-xs font-medium text-ink-2">Qty</span>
              <input
                value={l.qty}
                onChange={(e) => setLine(i, { qty: e.target.value })}
                inputMode="decimal"
                className="field-input num"
              />
            </label>
            <label className="block w-24">
              <span className="mb-1 block text-xs font-medium text-ink-2">Unit</span>
              <select
                value={l.unit}
                onChange={(e) => setLine(i, { unit: e.target.value })}
                className="field-input"
              >
                {Object.entries(PRODUCT_UNIT_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block w-24">
              <span className="mb-1 block text-xs font-medium text-ink-2">Unit $</span>
              <input
                value={l.unit_price}
                onChange={(e) => setLine(i, { unit_price: e.target.value })}
                inputMode="decimal"
                className="field-input num"
                placeholder="—"
              />
            </label>
            <button
              type="button"
              aria-label="Remove line"
              onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={lines.length === 1}
              className="btn !px-2.5 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}
            className="btn"
          >
            <Plus className="h-4 w-4" /> Add line
          </button>
          <p className="text-sm text-ink-2">
            Subtotal <span className="num font-semibold text-ink">{money.format(subtotal)}</span>
          </p>
        </div>
      </div>

      <div className="panel p-5 space-y-4">
        <p className="eyebrow">Fulfillment</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Method</span>
            <select
              name="fulfillment"
              value={fulfillment}
              onChange={(e) => setFulfillment(e.target.value as "will_call" | "delivery")}
              className="field-input"
            >
              {Object.entries(FULFILLMENT_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Requested date</span>
            <input name="requested_date" type="date" className="field-input" />
          </label>
        </div>
        {fulfillment === "delivery" ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Delivery address</span>
            <input name="delivery_address" className="field-input" placeholder="Street, city" />
          </label>
        ) : null}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Notes</span>
          <textarea name="notes" rows={2} className="field-input" placeholder="Anything the warehouse should know" />
        </label>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-danger/30 bg-danger-tint px-4 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
        {pending ? "Creating…" : "Create order"}
      </button>
    </form>
  );
}
