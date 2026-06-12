#!/usr/bin/env node
/**
 * Import Base44 inventory data into Supabase.
 *
 * Usage:
 *   node scripts/import-inventory.mjs [--dry-run] [--input-dir <path>]
 *
 * Defaults --input-dir to /tmp/inventory-seed. Reads either canonical names
 * (products.csv, rolls.csv, ...) or Base44 export names (Product_export.csv,
 * Roll_export.csv, ...).
 *
 *  Vendor_export.csv      → vendors                 (upsert on name)
 *  Product_export.csv     → inv_products            (upsert on name)
 *  Roll_export.csv        → inv_rolls               (upsert on tt_sku_tag_number)
 *                         + inv_locations           (derived, upsert on name)
 *                         + inv_jobs                (derived, upsert on job_number)
 *                         + inv_allocations         (derived from rolls.allocated_job_id)
 *  Transaction_export.csv → inv_transactions        (insert only; append-only)
 *  Settings_export.csv    → inv_settings            (upsert on key)
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ─── Args ────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes("--dry-run");
const inputArgIdx = process.argv.indexOf("--input-dir");
const INPUT_DIR = inputArgIdx >= 0 ? process.argv[inputArgIdx + 1] : "/tmp/inventory-seed";

// ─── Env loader ──────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error("✗ .env.local not found at", envPath);
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ─── CSV parser ──────────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false, i = 0;
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
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
}

// ─── File discovery ──────────────────────────────────────────────────────────
function findFile(...candidates) {
  if (!existsSync(INPUT_DIR)) return null;
  const files = readdirSync(INPUT_DIR);
  for (const want of candidates) {
    const wantLower = want.toLowerCase();
    const found = files.find((f) => f.toLowerCase() === wantLower);
    if (found) return resolve(INPUT_DIR, found);
  }
  // Fuzzy fallback — match by prefix
  for (const want of candidates) {
    const stem = want.split(".")[0].toLowerCase();
    const found = files.find((f) => f.toLowerCase().startsWith(stem));
    if (found) return resolve(INPUT_DIR, found);
  }
  return null;
}

function loadCsv(...candidates) {
  const path = findFile(...candidates);
  if (!path) {
    console.warn(`⚠  ${candidates[0]} not found in ${INPUT_DIR}; skipping`);
    return null;
  }
  const rows = parseCsv(readFileSync(path, "utf8"));
  console.log(`  ↪ ${rows.length} rows from ${path.split("/").pop()}`);
  return rows;
}

// ─── Normalization ───────────────────────────────────────────────────────────

// Map messy Base44 product names → canonical
function canonicalProduct(name) {
  if (!name) return null;
  const k = name.replace(/[\s\n\r]+/g, " ").trim().toLowerCase();
  const lookup = {
    "kent": "Kent 44",
    "kent 44": "Kent 44",
    "majestic": "Majestic 70",
    "majestic 70": "Majestic 70",
    "saratoga 40": "Saratoga 40",
    "saratoga 60": "Saratoga 60",
    "royal 40": "Royal 40",
    "monte carlo 60": "Monte Carlo 60",
    "texashaven": "TexasHaven",
    "texaslush": "TexasLush",
    "texasplay": "TexasPlay",
    "texasmoss": "TexasMoss",
    "texasputt": "TexasPutt",
  };
  return lookup[k] ?? name.replace(/[\s\n\r]+/g, " ").trim();
}

// Map messy Base44 vendor names → canonical (from Vendor_export.csv)
function canonicalVendor(name) {
  if (!name) return null;
  const k = name.replace(/[\s\n\r]+/g, " ").trim().toLowerCase();
  if (k === "agl" || k === "agl grass")        return "AGL Grass";
  if (k === "mighty grass" || k === "mighty")  return "Mighty Grass";
  if (k === "global syn-turf" || k === "gst")  return "GST";
  return name.trim();
}

// Map Base44 status → our roll_status enum
function canonicalRollStatus(s) {
  const k = String(s ?? "").trim().toLowerCase();
  const map = {
    "available":  "available",
    "planned":    "planned",
    "allocated":  "allocated",
    "staged":     "staged",
    "dispatched": "dispatched",
    "consumed":   "consumed",
    "scrapped":   "damaged",   // Base44 'Scrapped' → our 'damaged'
    "damaged":    "damaged",
    "returned":   "returned",
  };
  return map[k] ?? "available";
}

function canonicalRollType(s) {
  return String(s ?? "").trim().toLowerCase() === "child" ? "child" : "parent";
}

// ─── Field helpers ───────────────────────────────────────────────────────────
const nullable = (v) => (v == null || v === "" ? null : v.trim());
const numOrNull = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function widthFromOptions(widthOptions) {
  // "[13]" → 13, "[15]" → 15
  if (!widthOptions) return null;
  const m = String(widthOptions).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

// ─── Insert helpers ──────────────────────────────────────────────────────────

/**
 * Get-or-create by natural key. Returns an array of {id, [naturalKey]} for
 * the *full* set of input rows (existing + newly inserted).
 *
 * This pattern is used in place of `upsert(onConflict=naturalKey)` because
 * the target tables don't currently have UNIQUE constraints on these columns.
 * Safe to re-run: existing rows are matched and skipped.
 */
async function upsertBy(table, rows, naturalKey) {
  if (rows.length === 0) { console.log(`  ⊘  ${table}: nothing to upsert`); return []; }

  const naturalValues = [...new Set(rows.map((r) => r[naturalKey]).filter((v) => v != null))];

  if (DRY_RUN) {
    console.log(`  [dry-run] would get-or-create ${rows.length} in ${table} by ${naturalKey}`);
    if (rows[0]) console.log(`            sample:`, rows[0]);
    return rows.map((r) => ({ id: `dry-${naturalKey}:${r[naturalKey]}`, [naturalKey]: r[naturalKey] }));
  }

  // 1. Find existing
  const { data: existing, error: selErr } = await supabase
    .from(table).select(`id, ${naturalKey}`).in(naturalKey, naturalValues);
  if (selErr) { console.error(`  ✗ ${table} lookup:`, selErr.message); throw selErr; }
  const existingMap = new Map((existing ?? []).map((e) => [e[naturalKey], e.id]));

  // 2. Insert only the new ones (dedup by natural key in the payload too)
  const seen = new Set();
  const toInsert = rows.filter((r) => {
    const key = r[naturalKey];
    if (!key || existingMap.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let inserted = [];
  if (toInsert.length > 0) {
    const { data, error } = await supabase.from(table).insert(toInsert).select(`id, ${naturalKey}`);
    if (error) { console.error(`  ✗ ${table} insert:`, error.message); throw error; }
    inserted = data ?? [];
  }

  console.log(`  ✓ ${table}: ${existingMap.size} existing + ${inserted.length} new = ${existingMap.size + inserted.length} total`);

  return [
    ...[...existingMap.entries()].map(([k, id]) => ({ id, [naturalKey]: k })),
    ...inserted,
  ];
}

async function insertMany(table, rows) {
  if (rows.length === 0) { console.log(`  ⊘  ${table}: nothing to insert`); return []; }
  if (DRY_RUN) {
    console.log(`  [dry-run] would insert ${rows.length} into ${table}`);
    if (rows[0]) console.log(`            sample:`, rows[0]);
    return [];
  }
  const { data, error } = await supabase.from(table).insert(rows).select("id");
  if (error) { console.error(`  ✗ ${table} insert:`, error.message); throw error; }
  console.log(`  ✓ inserted ${data.length} into ${table}`);
  return data;
}

// ─── Main flow ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Importing inventory from ${INPUT_DIR}\n`);

  console.log("Reading CSVs…");
  const vendorsCsv  = loadCsv("vendors.csv",      "Vendor_export.csv");
  const productsCsv = loadCsv("products.csv",     "Product_export.csv");
  const rollsCsv    = loadCsv("rolls.csv",        "Roll_export (1).csv", "Roll_export.csv");
  const txCsv       = loadCsv("transactions.csv", "Transaction_export.csv");
  const settingsCsv = loadCsv("settings.csv",     "Settings_export.csv");

  // ── 1. Vendors ────────────────────────────────────────────────────────────
  console.log("\n1/7  Vendors");
  const vendorRows = (vendorsCsv ?? []).map((r) => ({
    name:         canonicalVendor(r.vendor_name),
    type:         "supplier",
    contact_name: nullable(r.contact_name),
    email:        nullable(r.email),
    phone:        nullable(r.phone),
    address:      nullable(r.address),
    notes:        nullable(r.notes),
    active:       true,
  })).filter((r) => r.name);

  const vendorIds = await upsertBy("vendors", vendorRows, "name");
  const vendorByName = new Map(vendorIds.map((v) => [v.name, v.id]));

  // ── 2. Products ───────────────────────────────────────────────────────────
  console.log("\n2/7  Products");
  const productRows = (productsCsv ?? []).map((r) => ({
    name:        canonicalProduct(r.product_name),
    sku:         nullable(r.sku_code),
    width_ft:    widthFromOptions(r.width_options),
    description: r.manufacturer_name ? `Manufacturer: ${r.manufacturer_name}` : null,
    active:      String(r.status ?? "").toLowerCase() !== "inactive",
  })).filter((r) => r.name);

  const productIds = await upsertBy("inv_products", productRows, "name");
  const productByName = new Map(productIds.map((p) => [p.name, p.id]));

  // ── 3. Locations (derived from rolls) ─────────────────────────────────────
  console.log("\n3/7  Locations (derived)");
  const locByBase44 = new Map(); // base44 id → preferred name
  for (const r of (rollsCsv ?? [])) {
    if (!r.location_id) continue;
    const name = (r.location_name || r.location_row || "").trim() || `Loc ${r.location_id.slice(-6)}`;
    if (!locByBase44.has(r.location_id)) locByBase44.set(r.location_id, name);
  }
  const locationRows = [...new Set(locByBase44.values())].map((name) => ({
    name, description: null, active: true,
  }));
  const locationIds = await upsertBy("inv_locations", locationRows, "name");
  const locationByName = new Map(locationIds.map((l) => [l.name, l.id]));
  const locationByBase44 = new Map(
    [...locByBase44.entries()].map(([b44, name]) => [b44, locationByName.get(name)]),
  );

  // ── 4. Jobs (derived from rolls + transactions) ───────────────────────────
  console.log("\n4/7  Jobs (derived)");

  // Build base44_job_id → job_number lookup from transactions
  const jobNumByBase44 = new Map();
  for (const t of (txCsv ?? [])) {
    if (t.job_id && t.job_number) jobNumByBase44.set(t.job_id, t.job_number);
  }

  const jobBase44Ids = new Set();
  for (const r of (rollsCsv ?? [])) {
    if (r.allocated_job_id) jobBase44Ids.add(r.allocated_job_id);
  }
  for (const b44 of jobNumByBase44.keys()) jobBase44Ids.add(b44);

  const jobRows = [...jobBase44Ids].map((b44) => {
    const jobNum = jobNumByBase44.get(b44);
    return {
      job_number: jobNum ?? b44.slice(-6),
      job_name:   jobNum ? `Job ${jobNum}` : `Job ${b44.slice(-6)}`,
      status:     "Active",
      notes:      `Imported from Base44 (id=${b44})`,
    };
  });
  const jobIds = await upsertBy("inv_jobs", jobRows, "job_number");
  const jobIdByNumber = new Map(jobIds.map((j) => [j.job_number, j.id]));
  const jobIdByBase44 = new Map();
  for (const b44 of jobBase44Ids) {
    const jobNum = jobNumByBase44.get(b44) ?? b44.slice(-6);
    const supaId = jobIdByNumber.get(jobNum);
    if (supaId) jobIdByBase44.set(b44, supaId);
  }

  // ── 5. Rolls ──────────────────────────────────────────────────────────────
  console.log("\n5/7  Rolls (first pass)");
  const rollSource = rollsCsv ?? [];
  const rollPayload = rollSource.map((r) => {
    const productName = canonicalProduct(r.product_name);
    const vendorName  = canonicalVendor(r.vendor_name);
    return {
      tt_sku_tag_number:        nullable(r.tt_sku_tag_number),
      manufacturer_roll_number: nullable(r.manufacturer_roll_number),
      vendor_id:                vendorByName.get(vendorName) ?? null,
      product_id:               productByName.get(productName) ?? null,
      product_name:             productName,
      dye_lot:                  nullable(r.dye_lot),
      width_ft:                 numOrNull(r.width_ft),
      original_length_ft:       numOrNull(r.original_length_ft),
      current_length_ft:        numOrNull(r.current_length_ft),
      status:                   canonicalRollStatus(r.status),
      roll_type:                canonicalRollType(r.roll_type),
      parent_roll_id:           null,
      location_id:              locationByBase44.get(r.location_id) ?? null,
      allocated_job_id:         jobIdByBase44.get(r.allocated_job_id) ?? null,
      notes:                    nullable(r.notes),
      _base44_id:               r.id,        // stripped before insert
      _base44_parent:           r.parent_roll_id || null,
    };
  });

  // Disambiguate duplicate tt_sku_tag_numbers within the input (Base44 sometimes
  // reuses a manufacturer number for distinct physical rolls — e.g., "na" for
  // multiple child cuts). Keep first occurrence as-is so it matches any existing
  // import; suffix 2nd-Nth with the Base44 id tail.
  const tagCounts = new Map();
  for (const p of rollPayload) {
    if (p.tt_sku_tag_number) tagCounts.set(p.tt_sku_tag_number, (tagCounts.get(p.tt_sku_tag_number) ?? 0) + 1);
  }
  const seenTags = new Map();
  let disambigCount = 0;
  for (const p of rollPayload) {
    const tag = p.tt_sku_tag_number;
    if (!tag) continue;
    const total = tagCounts.get(tag) ?? 1;
    if (total <= 1) continue;
    const seen = seenTags.get(tag) ?? 0;
    if (seen > 0) {
      const suffix = (p._base44_id ?? `dup${seen}`).slice(-6);
      p.tt_sku_tag_number = `${tag}/${suffix}`;
      disambigCount++;
    }
    seenTags.set(tag, seen + 1);
  }
  if (disambigCount > 0) console.log(`  ↪ disambiguated ${disambigCount} duplicate roll tags`);

  const rollsForInsert = rollPayload.map(({ _base44_id, _base44_parent, ...rest }) => rest);
  const rollResults = await upsertBy("inv_rolls", rollsForInsert, "tt_sku_tag_number");
  // Build base44 → supabase id map. tt_sku_tag_number is unique for child rolls but
  // some parent rolls may not have it — match what we can.
  const rollIdByTag = new Map(rollResults.map((r) => [r.tt_sku_tag_number, r.id]));
  const rollIdByBase44 = new Map();
  for (const p of rollPayload) {
    const tag = p.tt_sku_tag_number;
    if (tag && rollIdByTag.has(tag)) rollIdByBase44.set(p._base44_id, rollIdByTag.get(tag));
  }
  console.log(`  ↪ resolved ${rollIdByBase44.size}/${rollPayload.length} base44→supabase roll ids via tt_sku_tag_number`);

  // ── 5b. Parent links ──────────────────────────────────────────────────────
  console.log("\n5b   Resolving parent_roll_id links");
  const parentUpdates = [];
  for (const p of rollPayload) {
    if (!p._base44_parent) continue;
    const supaSelf = rollIdByBase44.get(p._base44_id);
    const supaParent = rollIdByBase44.get(p._base44_parent);
    if (supaSelf && supaParent) parentUpdates.push({ self: supaSelf, parent: supaParent });
  }
  if (DRY_RUN) {
    console.log(`  [dry-run] would resolve ${parentUpdates.length} parent links`);
  } else {
    for (const u of parentUpdates) {
      const { error } = await supabase.from("inv_rolls")
        .update({ parent_roll_id: u.parent }).eq("id", u.self);
      if (error) console.warn(`    ! parent link: ${error.message}`);
    }
    console.log(`  ✓ ${parentUpdates.length} parent links resolved`);
  }

  // ── 6. Allocations (derived from rolls.allocated_job_id) ──────────────────
  // Dedup by (job_id, roll_id) — same job + same roll = same allocation.
  console.log("\n6/7  Allocations (derived)");
  const allocRows = [];
  for (const p of rollPayload) {
    const supaRoll = rollIdByBase44.get(p._base44_id);
    if (!supaRoll || !p.allocated_job_id) continue;
    if (!["allocated", "staged", "dispatched", "consumed"].includes(p.status)) continue;
    allocRows.push({
      job_id:              p.allocated_job_id,
      roll_id:             supaRoll,
      product_id:          p.product_id,
      product_name:        p.product_name,
      width_ft:            p.width_ft,
      dye_lot_preference:  p.dye_lot,
      requested_length_ft: p.current_length_ft,
      status: ({
        allocated:  "Allocated",
        staged:     "Staged",
        dispatched: "Dispatched",
        consumed:   "Consumed",
      })[p.status] ?? "Planned",
      notes: "Imported from Base44",
    });
  }
  // Filter out (job_id, roll_id) pairs that already exist
  if (allocRows.length > 0 && !DRY_RUN) {
    const rollIds = [...new Set(allocRows.map((a) => a.roll_id))];
    const { data: existingAllocs } = await supabase
      .from("inv_allocations").select("job_id, roll_id").in("roll_id", rollIds);
    const existSet = new Set((existingAllocs ?? []).map((a) => `${a.job_id}::${a.roll_id}`));
    const before = allocRows.length;
    const fresh = allocRows.filter((a) => !existSet.has(`${a.job_id}::${a.roll_id}`));
    console.log(`  ↪ ${before - fresh.length} allocations already exist; ${fresh.length} new`);
    await insertMany("inv_allocations", fresh);
  } else {
    await insertMany("inv_allocations", allocRows);
  }

  // ── 7. Transactions ───────────────────────────────────────────────────────
  // Dedup by the Base44 transaction id, stashed as a marker in notes.
  console.log("\n7/7  Transactions");
  const txRows = (txCsv ?? []).map((t) => ({
    transaction_type: t.transaction_type || "Unknown",
    roll_id:          rollIdByBase44.get(t.roll_id) ?? rollIdByBase44.get(t.child_roll_id) ?? null,
    job_id:           jobIdByBase44.get(t.job_id) ?? null,
    from_status:      nullable(t.location_from),
    to_status:        nullable(t.location_to),
    quantity_ft:      numOrNull(t.length_change_ft),
    notes:            [
      t.id ? `[b44:${t.id}]` : null,
      nullable(t.notes),
      t.performed_by ? `by ${t.performed_by}` : null,
      t.manufacturer_roll_number ? `mfg #${t.manufacturer_roll_number}` : null,
    ].filter(Boolean).join(" | ") || null,
    created_by:       null,
    _b44_id:          t.id,
  }));
  if (txRows.length > 0 && !DRY_RUN) {
    const b44Ids = txRows.map((t) => t._b44_id).filter(Boolean);
    // Fetch existing markers in batches of 100 to keep .or() URLs reasonable
    const existingMarkers = new Set();
    for (let i = 0; i < b44Ids.length; i += 100) {
      const chunk = b44Ids.slice(i, i + 100);
      const filter = chunk.map((id) => `notes.ilike.%[b44:${id}]%`).join(",");
      const { data } = await supabase.from("inv_transactions").select("notes").or(filter);
      for (const row of (data ?? [])) {
        const m = row.notes?.match(/\[b44:([^\]]+)\]/);
        if (m) existingMarkers.add(m[1]);
      }
    }
    const before = txRows.length;
    const fresh = txRows.filter((t) => !existingMarkers.has(t._b44_id)).map(({ _b44_id, ...rest }) => rest);
    console.log(`  ↪ ${before - fresh.length} transactions already exist; ${fresh.length} new`);
    await insertMany("inv_transactions", fresh);
  } else {
    await insertMany("inv_transactions", txRows.map(({ _b44_id, ...rest }) => rest));
  }

  // ── 8. Settings ───────────────────────────────────────────────────────────
  console.log("\n+    Inventory settings");
  const settingRows = (settingsCsv ?? []).map((s) => ({
    key:         s.setting_key,
    // wrap raw text in jsonb (numbers stay numbers, otherwise quote as string)
    value:       /^-?\d+(\.\d+)?$/.test(s.setting_value) ? JSON.parse(s.setting_value) : s.setting_value,
    description: nullable(s.description),
  })).filter((r) => r.key);
  try {
    await upsertBy("inv_settings", settingRows, "key");
  } catch (err) {
    if (/inv_settings/.test(err.message) && /schema cache|does not exist/.test(err.message)) {
      console.warn("  ⚠  inv_settings table not present — apply migration 20260529000000_init_inv_settings.sql, then re-run with just the settings step.");
    } else {
      throw err;
    }
  }

  console.log("\n✓ Import complete.");
  if (DRY_RUN) console.log("  Re-run without --dry-run to actually write to Supabase.\n");
  else         console.log("");
}

main().catch((err) => {
  console.error("\n✗ Import aborted:", err.message);
  process.exit(1);
});
