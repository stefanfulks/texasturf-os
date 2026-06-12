"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InvLocation, InvProduct, RollStatus } from "@/lib/db-helpers.types";

const STATUS_OPTIONS: Array<[RollStatus, string]> = [
  ["available", "Available"],
  ["planned", "Planned"],
  ["allocated", "Allocated"],
  ["staged", "Staged"],
  ["dispatched", "Dispatched"],
  ["consumed", "Consumed"],
  ["damaged", "Damaged"],
  ["returned", "Returned"],
];

const field =
  "text-sm border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-strong bg-white";

export function RollFilterBar({
  locations,
  products,
  initialStatus,
  initialLocationId,
  initialProductId,
  initialSearch,
}: {
  locations: Pick<InvLocation, "id" | "name">[];
  products: Pick<InvProduct, "id" | "name">[];
  initialStatus: string;
  initialLocationId: string;
  initialProductId: string;
  initialSearch: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [productId, setProductId] = useState(initialProductId);
  const [search, setSearch] = useState(initialSearch);
  const [showSuggest, setShowSuggest] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  function pushFilters(next: {
    status?: string;
    location_id?: string;
    product_id?: string;
    search?: string;
  }) {
    const params = new URLSearchParams();
    const merged = {
      status: next.status ?? status,
      location_id: next.location_id ?? locationId,
      product_id: next.product_id ?? productId,
      search: next.search ?? search,
    };
    if (merged.status) params.set("status", merged.status);
    if (merged.location_id) params.set("location_id", merged.location_id);
    if (merged.product_id) params.set("product_id", merged.product_id);
    if (merged.search) params.set("search", merged.search);
    const qs = params.toString();
    router.push(`/inventory/rolls${qs ? "?" + qs : ""}`);
  }

  function reset() {
    setStatus("");
    setLocationId("");
    setProductId("");
    setSearch("");
    setShowSuggest(false);
    router.push("/inventory/rolls");
  }

  // ── Product autocomplete: surface matches once user has typed 2+ chars ──
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, products]);

  // Close suggest dropdown on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pickProduct(p: Pick<InvProduct, "id" | "name">) {
    setProductId(p.id);
    setSearch("");
    setShowSuggest(false);
    pushFilters({ product_id: p.id, search: "" });
  }

  const hasFilters = status || locationId || productId || search;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={wrapRef} className="relative flex-1 min-w-[200px] max-w-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setShowSuggest(false);
            pushFilters({ search });
          }}
        >
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSuggest(true);
            }}
            onFocus={() => setShowSuggest(true)}
            placeholder="Search TT SKU, mfg #, product…"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggest && suggestions.length > 0}
            aria-controls="roll-product-suggestions"
            className={`${field} w-full`}
          />
        </form>

        {/* Product suggestions — appear after the 2nd character */}
        {showSuggest && suggestions.length > 0 && (
          <div
            id="roll-product-suggestions"
            role="listbox"
            aria-label="Product suggestions"
            className="absolute z-20 mt-1 w-full bg-white border border-line rounded-lg shadow-lg overflow-hidden"
          >
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-4 bg-hover border-b border-line">
              Products
            </div>
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pickProduct(p)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-sunken focus:bg-sunken focus:outline-none"
              >
                <span className="text-ink">{highlightMatch(p.name, search)}</span>
                <span className="text-xs text-ink-4">filter by product</span>
              </button>
            ))}
          </div>
        )}
        {showSuggest && search.trim().length >= 2 && suggestions.length === 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-line rounded-lg shadow-lg px-3 py-2 text-xs text-ink-3">
            No products match — press Enter to search rolls by SKU / mfg #.
          </div>
        )}
      </div>

      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          pushFilters({ status: e.target.value });
        }}
        className={field}
      >
        <option value="">All Status</option>
        {STATUS_OPTIONS.map(([val, label]) => (
          <option key={val} value={val}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={locationId}
        onChange={(e) => {
          setLocationId(e.target.value);
          pushFilters({ location_id: e.target.value });
        }}
        className={field}
      >
        <option value="">All Locations</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <select
        value={productId}
        onChange={(e) => {
          setProductId(e.target.value);
          pushFilters({ product_id: e.target.value });
        }}
        className={field}
      >
        <option value="">All Products</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={reset}
          className="text-xs text-ink-3 hover:text-ink px-2 py-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}

/** Wrap matched substring in <strong> so the user sees what they typed. */
function highlightMatch(name: string, query: string): React.ReactNode {
  const q = query.trim();
  if (q.length < 2) return name;
  const lower = name.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return name;
  return (
    <>
      {name.slice(0, idx)}
      <strong className="font-semibold text-ink bg-warn-tint rounded px-0.5">
        {name.slice(idx, idx + q.length)}
      </strong>
      {name.slice(idx + q.length)}
    </>
  );
}
