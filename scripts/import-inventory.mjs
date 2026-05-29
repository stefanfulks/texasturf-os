#!/usr/bin/env node
/**
 * Import Base44 inventory data into Supabase.
 *
 * Usage:
 *   node scripts/import-inventory.mjs [--dry-run]
 *
 * Reads CSVs from /tmp/inventory-seed/:
 *   locations.csv  → inv_locations
 *   products.csv   → inv_products
 *   items.csv      → inv_items
 *   jobs.csv       → inv_jobs
 *   rolls.csv      → inv_rolls
 *   allocations.csv → inv_allocations
 *   transactions.csv → inv_transactions
 *
 * Requires env vars (read from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Each CSV must include the Base44 entity `id` column. The importer
 * builds base44_id → supabase_uuid maps to wire up relationships.
 *
 * Field-name mappings are defined in FIELD_MAPS below. If a Cowork
 * export uses different column names, update FIELD_MAPS — the rest
 * of the script is generic.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SEED_DIR = "/tmp/inventory-seed";
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Env loader ───────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error("✗ .env.local not found at", envPath);
    process.exit(1);
  }
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── CSV parser (handles quoted fields with commas/newlines) ──────────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\n" || c === "\r") {
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
        i++; continue;
      }
      field += c; i++;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] ?? ""; });
    return obj;
  });
}

function readSeed(name) {
  const path = `${SEED_DIR}/${name}.csv`;
  if (!existsSync(path)) {
    console.warn(`⚠  ${name}.csv not found, skipping`);
    return null;
  }
  const text = readFileSync(path, "utf8");
  const rows = parseCsv(text);
  console.log(`  read ${rows.length} rows from ${name}.csv`);
  return rows;
}

// ─── Field mappers ────────────────────────────────────────────────────────────
// Each mapper takes a Base44 row and returns a Supabase row.
// `maps` arg passes in resolved FK lookups built from earlier inserts.
//
// IMPORTANT: Update these field names to match the actual Base44 CSV headers
// once Cowork delivers the exports. Defaults assume snake_case.

const FIELD_MAPS = {
  locations: (r) => ({
    name: r.name || r.Name || "",
    description: r.description || r.Description || null,
    active: parseBool(r.active ?? r.Active, true),
  }),

  products: (r) => ({
    name: r.name || r.Name || "",
    sku: nullable(r.sku || r.SKU),
    width_ft: numberOrNull(r.width_ft || r.width),
    description: nullable(r.description || r.Description),
    active: parseBool(r.active ?? r.Active, true),
  }),

  items: (r, maps) => ({
    name: r.name || "",
    sku: nullable(r.sku),
    quantity: numberOrNull(r.quantity) ?? 0,
    unit: r.unit || "ea",
    min_quantity: numberOrNull(r.min_quantity) ?? 0,
    location_id: maps.locations.get(r.location_id) ?? null,
    notes: nullable(r.notes),
    active: parseBool(r.active, true),
  }),

  jobs: (r) => ({
    job_number: nullable(r.job_number),
    job_name: r.job_name || r.name || "",
    site_address: nullable(r.site_address || r.address),
    status: r.status || "planning",
    scheduled_date: dateOrNull(r.scheduled_date),
    completion_date: dateOrNull(r.completion_date),
    notes: nullable(r.notes),
  }),

  rolls: (r, maps) => ({
    tt_sku_tag_number: nullable(r.tt_sku_tag_number || r.tt_sku),
    manufacturer_roll_number: nullable(r.manufacturer_roll_number || r.manufacturer_number),
    vendor_id: null, // Base44 vendor IDs won't map; left null. Vendor name preserved in notes.
    product_id: maps.products.get(r.product_id) ?? null,
    product_name: nullable(r.product_name),
    dye_lot: nullable(r.dye_lot),
    width_ft: numberOrNull(r.width_ft),
    original_length_ft: numberOrNull(r.original_length_ft),
    current_length_ft: numberOrNull(r.current_length_ft),
    status: normalizeRollStatus(r.status),
    roll_type: r.roll_type === "child" ? "child" : "parent",
    parent_roll_id: null, // resolved in 2nd pass (see resolveRollParents)
    location_id: maps.locations.get(r.location_id) ?? null,
    allocated_job_id: maps.jobs.get(r.allocated_job_id) ?? null,
    notes: composeNotes(r.notes, r.vendor_name && `Vendor: ${r.vendor_name}`),
  }),

  allocations: (r, maps) => ({
    job_id: maps.jobs.get(r.job_id),
    roll_id: maps.rolls.get(r.roll_id) ?? null,
    product_id: maps.products.get(r.product_id) ?? null,
    product_name: nullable(r.product_name),
    width_ft: numberOrNull(r.width_ft),
    dye_lot_preference: nullable(r.dye_lot_preference),
    requested_length_ft: numberOrNull(r.requested_length_ft),
    status: r.status || "requested",
    notes: nullable(r.notes),
  }),

  transactions: (r, maps) => ({
    transaction_type: r.transaction_type || "unknown",
    roll_id: maps.rolls.get(r.roll_id) ?? null,
    job_id: maps.jobs.get(r.job_id) ?? null,
    from_status: nullable(r.from_status),
    to_status: nullable(r.to_status),
    quantity_ft: numberOrNull(r.quantity_ft),
    notes: nullable(r.notes),
    created_by: null, // Base44 user IDs won't map; left null
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nullable(v) { return v == null || v === "" ? null : v; }
function numberOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function dateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function parseBool(v, fallback) {
  if (v == null || v === "") return fallback;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}
function composeNotes(...parts) {
  return parts.filter(Boolean).join(" | ") || null;
}
function normalizeRollStatus(s) {
  const valid = ["available", "planned", "allocated", "staged", "dispatched", "consumed", "damaged", "returned"];
  const lower = String(s ?? "").toLowerCase();
  return valid.includes(lower) ? lower : "available";
}

// ─── Import flow ──────────────────────────────────────────────────────────────
async function importEntity(name, table, source, mapper, maps) {
  if (!source || source.length === 0) {
    console.log(`  ⊘  ${name}: nothing to import`);
    return new Map();
  }

  const rows = source.map((r) => ({ ...mapper(r, maps), __base44_id: r.id || r._id }));
  const payload = rows.map(({ __base44_id, ...rest }) => rest);

  if (DRY_RUN) {
    console.log(`  [dry-run] would insert ${payload.length} into ${table}`);
    console.log(`            sample:`, payload[0]);
    return new Map(rows.map((r, i) => [r.__base44_id, `dry-${i}`]));
  }

  const { data, error } = await supabase.from(table).insert(payload).select("id");
  if (error) {
    console.error(`  ✗ ${table} insert failed:`, error.message);
    throw error;
  }
  console.log(`  ✓ inserted ${data.length} into ${table}`);

  const idMap = new Map();
  data.forEach((row, i) => {
    if (rows[i].__base44_id) idMap.set(rows[i].__base44_id, row.id);
  });
  return idMap;
}

async function resolveRollParents(rolls, rollIdMap) {
  if (!rolls) return;
  const updates = rolls
    .filter((r) => r.parent_roll_id && rollIdMap.get(r.parent_roll_id))
    .map((r) => ({
      base44Id: r.id || r._id,
      parentUuid: rollIdMap.get(r.parent_roll_id),
    }));

  if (updates.length === 0) return;
  console.log(`  resolving ${updates.length} parent_roll_id references…`);

  if (DRY_RUN) {
    console.log(`  [dry-run] would update ${updates.length} rolls with parent_roll_id`);
    return;
  }

  for (const u of updates) {
    const newUuid = rollIdMap.get(u.base44Id);
    if (!newUuid) continue;
    const { error } = await supabase
      .from("inv_rolls")
      .update({ parent_roll_id: u.parentUuid })
      .eq("id", newUuid);
    if (error) console.warn(`    ! failed to set parent for roll ${u.base44Id}:`, error.message);
  }
  console.log(`  ✓ parent links resolved`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Importing inventory from ${SEED_DIR}\n`);

  console.log("Reading CSVs…");
  const sources = {
    locations: readSeed("locations"),
    products: readSeed("products"),
    items: readSeed("items"),
    jobs: readSeed("jobs"),
    rolls: readSeed("rolls"),
    allocations: readSeed("allocations"),
    transactions: readSeed("transactions"),
  };

  const maps = {
    locations: new Map(),
    products: new Map(),
    items: new Map(),
    jobs: new Map(),
    rolls: new Map(),
  };

  console.log("\n1/7  Locations");
  maps.locations = await importEntity("Locations", "inv_locations", sources.locations, FIELD_MAPS.locations, maps);

  console.log("\n2/7  Products");
  maps.products = await importEntity("Products", "inv_products", sources.products, FIELD_MAPS.products, maps);

  console.log("\n3/7  Items");
  maps.items = await importEntity("Items", "inv_items", sources.items, FIELD_MAPS.items, maps);

  console.log("\n4/7  Jobs");
  maps.jobs = await importEntity("Jobs", "inv_jobs", sources.jobs, FIELD_MAPS.jobs, maps);

  console.log("\n5/7  Rolls (first pass: ignore parent links)");
  maps.rolls = await importEntity("Rolls", "inv_rolls", sources.rolls, FIELD_MAPS.rolls, maps);

  console.log("\n5b/7 Rolls (second pass: resolve parent_roll_id)");
  await resolveRollParents(sources.rolls, maps.rolls);

  console.log("\n6/7  Allocations");
  await importEntity("Allocations", "inv_allocations", sources.allocations, FIELD_MAPS.allocations, maps);

  console.log("\n7/7  Transactions");
  await importEntity("Transactions", "inv_transactions", sources.transactions, FIELD_MAPS.transactions, maps);

  console.log("\n✓ Import complete.\n");
  if (DRY_RUN) console.log("  Re-run without --dry-run to actually write to Supabase.\n");
}

main().catch((err) => {
  console.error("\n✗ Import aborted:", err.message);
  process.exit(1);
});
