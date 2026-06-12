#!/usr/bin/env node
// Regenerate the PWA assets (home-screen icons + iOS launch screens).
//
//   node scripts/generate-pwa-assets.mjs
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

// ── The mark ─────────────────────────────────────────────────────────────────
// The TexasTurf favicon mark: a white upward triangle on a solid black field.
// The favicon's own circular container is dropped here — on a home screen iOS
// supplies the rounded-square mask, so the black field fills the tile edge to
// edge (also what makes the 512 double as a maskable icon). Triangle geometry
// matches the favicon's proportions (~49% wide, ~40% tall, optically centered).
function iconSvg({ cornerRadius = 0 } = {}) {
  const clip =
    cornerRadius > 0
      ? `<clipPath id="tile"><rect width="512" height="512" rx="${cornerRadius}"/></clipPath>`
      : "";
  const wrap = cornerRadius > 0 ? ` clip-path="url(#tile)"` : "";
  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>${clip}</defs>
  <g${wrap}>
    <rect width="512" height="512" fill="#000000"/>
    <polygon points="256,158 382,366 130,366" fill="#ffffff"/>
  </g>
</svg>`;
}

const flat = Buffer.from(iconSvg());
const tile = Buffer.from(iconSvg({ cornerRadius: 114 })); // iOS-style rounded tile for launch screens

const iconsDir = path.join(root, "public", "icons");
const splashDir = path.join(root, "public", "splash");
mkdirSync(iconsDir, { recursive: true });
mkdirSync(splashDir, { recursive: true });

async function png(svg, size, file) {
  await sharp(svg).resize(size, size).png().toFile(file);
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

async function splash({ css, dpr }) {
  const [w, h] = [css[0] * dpr, css[1] * dpr];
  const tileSize = Math.round(w * 0.3);
  const icon = await sharp(tile).resize(tileSize, tileSize).png().toBuffer();
  const file = path.join(splashDir, `splash-${w}x${h}.png`);
  await sharp({
    create: { width: w, height: h, channels: 3, background: "#faf9f6" },
  })
    .composite([
      {
        input: icon,
        left: Math.round((w - tileSize) / 2),
        top: Math.round((h - tileSize) / 2),
      },
    ])
    .png()
    .toFile(file);
  console.log(`✓ ${path.relative(root, file)}`);
}

await png(flat, 192, path.join(iconsDir, "icon-192.png"));
await png(flat, 512, path.join(iconsDir, "icon-512.png"));
await png(flat, 512, path.join(root, "src", "app", "icon.png"));
await png(flat, 180, path.join(root, "src", "app", "apple-icon.png"));
for (const device of SPLASH_DEVICES) await splash(device);
console.log("Done.");
