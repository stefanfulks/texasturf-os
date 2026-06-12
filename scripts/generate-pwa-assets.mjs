#!/usr/bin/env node
// Regenerate the PWA assets (home-screen icons + iOS launch screens) from the
// TexasTurf brand mark.
//
//   node scripts/generate-pwa-assets.mjs
//
// Source mark: scripts/assets/texasturf-mark.png — the "T" logo (charcoal/green
// split, Texas star, grass) with the wordmark and ™ cropped off, on a
// transparent background. To re-crop it from a full-logo export, extract the
// T-mark bounding box and trim the transparency (the original was lifted from
// "TexasTurf Favicon (black) logo.png", region ~{left:235,top:0,w:800,h:760}).
//
// Outputs:
//   src/app/icon.png            — browser-tab icon (Next file convention)
//   src/app/apple-icon.png      — apple-touch-icon (Next file convention)
//   public/icons/*.png          — manifest icons (home-screen install)
//   public/splash/*.png         — iOS launch screens (one per device class;
//                                 the matching media queries live in
//                                 src/app/layout.tsx `appleWebApp.startupImage`)
//
// sharp is not a direct dependency — Next ships it in the pnpm store for its
// image pipeline, so resolve it from there instead of adding a dep.
import { createRequire } from "node:module";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadSharp() {
  const store = path.join(root, "node_modules", ".pnpm");
  const entry = readdirSync(store).find((d) => d.startsWith("sharp@"));
  if (!entry) {
    console.error("sharp not found in node_modules/.pnpm — run `pnpm install` first.");
    process.exit(1);
  }
  return createRequire(import.meta.url)(
    path.join(store, entry, "node_modules", "sharp"),
  );
}
const sharp = loadSharp();

const MARK = path.join(root, "scripts", "assets", "texasturf-mark.png");

// Palette — the icon tile is white (the mark was drawn for a light ground, so
// its charcoal half and navy star keep full contrast). The splash sits on the
// app's warm canvas so first paint of the installed app matches.
const ICON_BG = "#ffffff";
const CANVAS = "#faf9f6";

const iconsDir = path.join(root, "public", "icons");
const splashDir = path.join(root, "public", "splash");
mkdirSync(iconsDir, { recursive: true });
mkdirSync(splashDir, { recursive: true });

// Scale the mark to fit (contain) inside a square box of `box` px.
function markFitting(box) {
  return sharp(MARK).resize(box, box, { fit: "inside" }).png().toBuffer();
}

// Full-bleed square icon: white field, mark centered at ~78% (iOS rounds the
// corners itself, so no rounding baked in).
async function icon(size, file) {
  const mark = await markFitting(Math.round(size * 0.78));
  await sharp({
    create: { width: size, height: size, channels: 4, background: ICON_BG },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(file);
  console.log(`✓ ${path.relative(root, file)} (${size}x${size})`);
}

// One device class per physical portrait resolution. Keep in sync with the
// startupImage media queries in src/app/layout.tsx.
const SPLASH_DEVICES = [
  { css: [375, 667], dpr: 2 }, // SE 2/3
  { css: [414, 896], dpr: 2 }, // XR / 11
  { css: [414, 896], dpr: 3 }, // XS Max / 11 Pro Max
  { css: [375, 812], dpr: 3 }, // X / XS / 11 Pro / 12-13 mini
  { css: [390, 844], dpr: 3 }, // 12 / 13 / 14
  { css: [393, 852], dpr: 3 }, // 14 Pro / 15 / 16
  { css: [402, 874], dpr: 3 }, // 16 Pro / 17
  { css: [428, 926], dpr: 3 }, // 12-13 Pro Max / 14 Plus
  { css: [430, 932], dpr: 3 }, // 14-15 Pro Max / 15-16 Plus
  { css: [440, 956], dpr: 3 }, // 16 Pro Max / 17 Pro Max
];

// Launch screen: the mark centered on the warm canvas, sized to ~30% of the
// shorter edge so it reads the same across device classes.
async function splash({ css, dpr }) {
  const [w, h] = [css[0] * dpr, css[1] * dpr];
  const mark = await markFitting(Math.round(Math.min(w, h) * 0.3));
  const file = path.join(splashDir, `splash-${w}x${h}.png`);
  await sharp({
    create: { width: w, height: h, channels: 3, background: CANVAS },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(file);
  console.log(`✓ ${path.relative(root, file)}`);
}

await icon(192, path.join(iconsDir, "icon-192.png"));
await icon(512, path.join(iconsDir, "icon-512.png"));
await icon(512, path.join(root, "src", "app", "icon.png"));
await icon(180, path.join(root, "src", "app", "apple-icon.png"));
for (const device of SPLASH_DEVICES) await splash(device);
console.log("Done.");
