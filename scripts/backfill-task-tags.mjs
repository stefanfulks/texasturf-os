#!/usr/bin/env node
/**
 * One-time backfill: copy each task's legacy tags text[] into the app-wide
 * tag system (tags registry + entity_tags links). Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/backfill-task-tags.mjs [--dry-run]
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (trusted local backfill; never a user code path)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ─── Env loader (mirrors scripts/import-inventory.mjs) ──────────────────────
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

const dry = process.argv.includes("--dry-run");
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Same normalization as src/lib/tags/normalize.ts (kept in sync by hand —
// this script is one-shot and standalone by design).
const slugify = (s) => s.toLowerCase().trim().replace(/\s+/g, "-")
  .replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
const COLORS = ["slate","red","amber","green","blue","violet","pink","teal","orange","gray"];
const colorFor = (slug) => COLORS[[...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

const { data: tasks, error: tasksErr } = await sb.from("tasks").select("id, tags");
if (tasksErr) { console.error("✗ reading tasks:", tasksErr.message); process.exit(1); }

const registry = {}; // slug -> id
const { data: existing, error: tagsErr } = await sb.from("tags").select("id, slug");
if (tagsErr) { console.error("✗ reading tags:", tagsErr.message); process.exit(1); }
for (const t of existing ?? []) registry[t.slug] = t.id;

let applied = 0;
for (const task of tasks ?? []) {
  for (const raw of task.tags ?? []) {
    const slug = slugify(raw);
    if (!slug) continue;
    if (!registry[slug]) {
      if (dry) { console.log(`would create tag ${slug}`); registry[slug] = `dry-${slug}`; }
      else {
        const { data, error } = await sb.from("tags")
          .insert({ name: raw.trim(), slug, color: colorFor(slug) })
          .select("id").single();
        if (error) { console.error(`✗ creating tag ${slug}:`, error.message); process.exit(1); }
        registry[slug] = data.id;
      }
    }
    if (!dry) {
      const { error } = await sb.from("entity_tags").upsert(
        { tag_id: registry[slug], entity_type: "task", entity_id: task.id },
        { onConflict: "tag_id,entity_type,entity_id", ignoreDuplicates: true });
      if (error) { console.error(`✗ linking ${slug} -> task ${task.id}:`, error.message); process.exit(1); }
    }
    applied++;
  }
}
console.log(`${dry ? "[dry-run] " : ""}processed ${applied} task-tag links across ${(tasks ?? []).length} tasks`);
