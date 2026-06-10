"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createRoll,
  updateRoll,
  ROLL_FORM_INITIAL_STATE,
  type RollFormState,
} from "../actions";
import type {
  InvRoll,
  InvLocation,
  InvProduct,
  Vendor,
  RollStatus,
  RollType,
} from "@/lib/db-helpers.types";

const field =
  "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white";

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

const TYPE_OPTIONS: Array<[RollType, string]> = [
  ["parent", "Parent"],
  ["child", "Child"],
];

export function RollForm({
  mode,
  roll,
  locations,
  products,
  vendors,
}: {
  mode: "create" | "edit";
  roll?: InvRoll;
  locations: Pick<InvLocation, "id" | "name">[];
  products: Pick<InvProduct, "id" | "name">[];
  vendors: Pick<Vendor, "id" | "name">[];
}) {
  const router = useRouter();
  const action = mode === "create" ? createRoll : updateRoll;
  const [state, formAction, isPending] = useActionState<
    RollFormState,
    FormData
  >(action, ROLL_FORM_INITIAL_STATE);

  // Auto-fill current length from original length on create
  const [origLen, setOrigLen] = useState<string>(
    roll?.original_length_ft != null ? String(roll.original_length_ft) : "",
  );

  return (
    <form action={formAction} className="space-y-4">
      {mode === "edit" && roll && (
        <input type="hidden" name="id" value={roll.id} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            TT SKU Tag # *
          </label>
          <input
            name="tt_sku_tag_number"
            defaultValue={roll?.tt_sku_tag_number ?? ""}
            required
            placeholder="TT-12345"
            className={`${field} font-mono`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Manufacturer Roll #
          </label>
          <input
            name="manufacturer_roll_number"
            defaultValue={roll?.manufacturer_roll_number ?? ""}
            placeholder="MFG-001"
            className={field}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Vendor
          </label>
          <select
            name="vendor_id"
            defaultValue={roll?.vendor_id ?? ""}
            className={field}
          >
            <option value="">— None —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Product
          </label>
          <select
            name="product_id"
            defaultValue={roll?.product_id ?? ""}
            className={field}
          >
            <option value="">— None —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Dye Lot
          </label>
          <input
            name="dye_lot"
            defaultValue={roll?.dye_lot ?? ""}
            placeholder="DL-2024-01"
            className={field}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Width (ft)
          </label>
          <input
            name="width_ft"
            type="number"
            step="0.01"
            defaultValue={roll?.width_ft ?? ""}
            placeholder="15"
            className={field}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Original Length (ft)
          </label>
          <input
            name="original_length_ft"
            type="number"
            step="0.01"
            value={origLen}
            onChange={(e) => setOrigLen(e.target.value)}
            placeholder="100"
            className={field}
          />
        </div>
      </div>

      {mode === "edit" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Current Length (ft)
            </label>
            <input
              name="current_length_ft"
              type="number"
              step="0.01"
              defaultValue={roll?.current_length_ft ?? ""}
              placeholder="100"
              className={field}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Status
            </label>
            <select
              name="status"
              defaultValue={roll?.status ?? "available"}
              className={field}
            >
              {STATUS_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Roll Type
            </label>
            <select
              name="roll_type"
              defaultValue={roll?.roll_type ?? "parent"}
              className={field}
            >
              {TYPE_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {mode === "create" && (
        <>
          <input type="hidden" name="status" value="available" />
          <input type="hidden" name="roll_type" value="parent" />
        </>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Location
        </label>
        <select
          name="location_id"
          defaultValue={roll?.location_id ?? ""}
          className={field}
        >
          <option value="">— None —</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Notes
        </label>
        <textarea
          name="notes"
          defaultValue={roll?.notes ?? ""}
          rows={3}
          className={`${field} resize-none`}
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state.success && mode === "edit" && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Saved.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium bg-white text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending
            ? mode === "create"
              ? "Adding…"
              : "Saving…"
            : mode === "create"
              ? "Add Roll"
              : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
