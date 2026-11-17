#!/usr/bin/env node
/**
 * Exports default brand PNGs (and leftover *-christmas-* aliases) from
 * reference sheet art — not from favicon-christmas.svg.
 *
 * Masters live in icons/source/christmas/ (cropped tiles + reference-sheet PNG).
 * Re-run after replacing reference-sheet-20261117.png from design export.
 *
 * Usage: node scripts/export-christmas-icons-from-reference.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SOURCE_DIR = path.join(ROOT, 'icons', 'source', 'christmas');
const ICONS_DIR = path.join(ROOT, 'icons');

/** @type {const} Tiles on reference-sheet-20261117.png (1024×572), detected from art bounds. */
const SHEET_TILES = {
  smallRoundedLeft: { left: 38, top: 252, width: 79, height: 79 },
  mediumRounded: { left: 159, top: 204, width: 168, height: 168 },
  largeMaskableSquircle: { left: 364, top: 184, width: 189, height: 204 },
  plainSquareGreen: { left: 586, top: 200, width: 157, height: 168 },
  smallRoundedRight: { left: 908, top: 252, width: 78, height: 79 },
};

const SHEET_FILE = 'reference-sheet-20261117.png';

const MASTER_FILES = {
  plain: 'master-plain-square-green.png',
  maskable: 'master-maskable-squircle.png',
  push: 'master-push-rounded.png',
};

/**
 * @param {import('sharp').Sharp} pipeline
 * @param {number} size
 */
async function resizeToSquare(pipeline, size) {
  return pipeline
    .clone()
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function writeMaster(sheetPath, tile, masterName) {
  const out = path.join(SOURCE_DIR, masterName);
  await sharp(sheetPath)
    .extract(tile)
    .png({ compressionLevel: 9 })
    .toFile(out);
  return out;
}

/**
 * Tab/topbar favicon: embed the square tile so href=favicon.svg is the user art,
 * not a generated hat SVG that only appears after christmas-bootstrap.
 * @param {Buffer} png
 */
async function writeEmbeddedFavicon(png) {
  const b64 = png.toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title">
  <title id="title">Feira Boa</title>
  <image href="data:image/png;base64,${b64}" width="256" height="256" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
  await fs.writeFile(path.join(ROOT, 'favicon.svg'), svg);
  await fs.writeFile(path.join(ROOT, 'favicon-christmas.svg'), svg);
  console.log(`Wrote favicon.svg and favicon-christmas.svg (${svg.length} bytes, embedded PNG)`);
}

async function main() {
  const sheetPath = path.join(SOURCE_DIR, SHEET_FILE);
  try {
    await fs.access(sheetPath);
  } catch {
    throw new Error(`Missing ${sheetPath}. Copy the latest reference sheet PNG into icons/source/christmas/.`);
  }

  await fs.mkdir(SOURCE_DIR, { recursive: true });
  await fs.mkdir(ICONS_DIR, { recursive: true });

  await writeMaster(sheetPath, SHEET_TILES.plainSquareGreen, MASTER_FILES.plain);
  await writeMaster(sheetPath, SHEET_TILES.largeMaskableSquircle, MASTER_FILES.maskable);
  await writeMaster(sheetPath, SHEET_TILES.mediumRounded, MASTER_FILES.push);

  const plain = sharp(path.join(SOURCE_DIR, MASTER_FILES.plain));
  const maskable = sharp(path.join(SOURCE_DIR, MASTER_FILES.maskable));
  const push = sharp(path.join(SOURCE_DIR, MASTER_FILES.push));

  const exports = [
    { file: 'icon-192.png', size: 192, src: plain },
    { file: 'icon-512.png', size: 512, src: plain },
    { file: 'icon-1024.png', size: 1024, src: plain },
    { file: 'maskable-512.png', size: 512, src: maskable },
    { file: 'notification-96.png', size: 96, src: push },
    { file: 'badge-72.png', size: 72, src: push },
    { file: 'icon-christmas-192.png', size: 192, src: plain },
    { file: 'icon-christmas-512.png', size: 512, src: plain },
    { file: 'icon-christmas-1024.png', size: 1024, src: plain },
    { file: 'maskable-christmas-512.png', size: 512, src: maskable },
    { file: 'notification-christmas-96.png', size: 96, src: push },
    { file: 'badge-christmas-72.png', size: 72, src: push },
  ];

  for (const { file, size, src } of exports) {
    const buf = await resizeToSquare(src, size);
    const dest = path.join(ICONS_DIR, file);
    await fs.writeFile(dest, buf);
    console.log(`Wrote icons/${file} (${size}×${size}, ${buf.length} bytes)`);
  }

  const faviconPng = await resizeToSquare(plain, 256);
  await writeEmbeddedFavicon(faviconPng);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
