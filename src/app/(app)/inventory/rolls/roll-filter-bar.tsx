"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InvLocation, InvProduct, RollStatus } from "@/lib/database.types";

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
  "text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";

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
    router.push("/inventory/rolls");
  }

  const hasFilters = status || locationId || productId || search;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          pushFilters({ search });
        }}
        className="flex-1 min-w-[200px] max-w-sm"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search TT SKU, mfg #, product…"
          className={`${field} w-full`}
        />
      </form>

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
          className="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}
