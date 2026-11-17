#!/usr/bin/env node
/**
 * Renders the PWA/notification icons in icons/ from favicon.svg.
 *
 * Uses a locally installed Chrome/Edge in headless mode, the same
 * zero-dependency approach as build-social-card.mjs.
 *
 * Sizes and purposes match manifest.webmanifest and service-worker.js:
 *   - icon-192.png / icon-512.png / icon-1024.png: app icons (purpose "any")
 *   - maskable-512.png: full-bleed background with the mark in the safe zone
 *   - notification-96.png: web push notification icon
 *   - badge-72.png: monochrome status-bar badge (white mark, transparent bg)
 *
 * Usage: node scripts/build-icons.mjs [--include-christmas-svg]
 *
 * Christmas PNGs in icons/*-christmas-* are exported from reference art
 * (icons/source/christmas/, see scripts/export-christmas-icons-from-reference.mjs).
 * This script does NOT overwrite them unless you pass --include-christmas-svg
 * (legacy SVG/Chrome render — not the shipped seasonal icons).
 *
 * favicon-christmas.svg is still used for in-app brand marks; seasonal raster icons
 * are maintained via export-christmas-icons-from-reference.mjs.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ICONS_DIR = path.join(ROOT, 'icons');

/** @type {{ faviconFile: string, notificationFile: string, badgeFile: string }[]} */
const NOTIFICATION_SOURCES = [
  {
    faviconFile: 'favicon.svg',
    notificationFile: 'notification-96.png',
    badgeFile: 'badge-72.png',
  },
  {
    faviconFile: 'favicon-christmas.svg',
    notificationFile: 'notification-christmas-96.png',
    badgeFile: 'badge-christmas-72.png',
  },
];
const CHROME_TIMEOUT_MS = 60_000;

const GREEN = '#155b3b';

/** Artwork scale for maskable icons: must sit inside the 80% safe-zone circle. */
const MASKABLE_SCALE = 0.64;
/** Artwork scale for the monochrome badge. */
const BADGE_SCALE = 0.78;

const APP_ICON_TARGETS = [
  { file: 'icon-192.png', size: 192, kind: 'plain' },
  { file: 'icon-512.png', size: 512, kind: 'plain' },
  { file: 'icon-1024.png', size: 1024, kind: 'plain' },
  { file: 'maskable-512.png', size: 512, kind: 'maskable' },
];

const CHRISTMAS_APP_ICON_TARGETS = [
  { file: 'icon-christmas-192.png', size: 192, kind: 'plain' },
  { file: 'icon-christmas-512.png', size: 512, kind: 'plain' },
  { file: 'icon-christmas-1024.png', size: 1024, kind: 'plain' },
  { file: 'maskable-christmas-512.png', size: 512, kind: 'maskable' },
];

/** Basket silhouette for the badge: solid white, readable at 24x24. */
const BADGE_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path d="M15 31h34l-4.2 19H19.2L15 31Z" fill="#fff"/>
  <path d="M22 31c.3-5.4 3.7-8.1 10-8.1s9.7 2.7 10 8.1" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="4"/>
</svg>`;

function candidateBrowsers() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const list = [];
  if (process.env.CHROME_PATH) list.push(process.env.CHROME_PATH);
  list.push(
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  );
  return list.filter(Boolean);
}

async function findBrowser() {
  for (const candidate of candidateBrowsers()) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep probing
    }
  }
  return null;
}

function buildHtml({ size, kind, mark }) {
  const inner = Math.round(size * (kind === 'maskable' ? MASKABLE_SCALE : kind === 'badge' ? BADGE_SCALE : 1));
  const offset = Math.round((size - inner) / 2);
  const background = kind === 'badge' ? 'transparent' : kind === 'maskable' ? GREEN : 'transparent';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${size}px;
    height: ${size}px;
    overflow: hidden;
    background: ${background};
  }
  .mark {
    position: absolute;
    top: ${offset}px;
    left: ${offset}px;
    width: ${inner}px;
    height: ${inner}px;
    display: block;
  }
  .mark svg { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
  <div class="mark">${mark}</div>
</body>
</html>`;
}

function readPngSize(file) {
  const buffer = fsSync.readFileSync(file);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error('Output file is not a valid PNG');
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function render(browser, tmpDir, { file, size, kind, mark }) {
  const htmlPath = path.join(tmpDir, `${file}.html`);
  const profileDir = path.join(tmpDir, `chrome-profile-${file}`);
  const shotPath = path.join(tmpDir, file);

  await fs.writeFile(htmlPath, buildHtml({ size, kind, mark }), 'utf8');

  const args = [
    '--headless=new',
    `--screenshot=${shotPath}`,
    `--window-size=${size},${size}`,
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    '--virtual-time-budget=4000',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profileDir}`,
    pathToFileURL(htmlPath).href,
  ];

  try {
    await execFileAsync(browser, args, { timeout: CHROME_TIMEOUT_MS, windowsHide: true });
  } catch (error) {
    if (error.killed) {
      throw new Error(`Browser timed out after ${CHROME_TIMEOUT_MS}ms: ${browser}`);
    }
    throw new Error(`Browser failed (${browser}): ${error.message}`);
  }

  let stats = null;
  try {
    stats = await fs.stat(shotPath);
  } catch {
    throw new Error(
      `Browser produced no screenshot at ${shotPath}. Check that ${browser} supports --headless=new --screenshot.`,
    );
  }
  if (!stats || stats.size === 0) {
    throw new Error(`Browser produced an empty screenshot at ${shotPath}`);
  }

  const { width, height } = readPngSize(shotPath);
  if (width !== size || height !== size) {
    throw new Error(`${file} rendered as ${width}x${height}, expected ${size}x${size}. Skipping write.`);
  }

  const output = path.join(ICONS_DIR, file);
  await fs.copyFile(shotPath, output);
  const out = await fs.stat(output);
  console.log(`Wrote icons/${file} (${width}x${height}, ${out.size} bytes)`);
}

function includeChristmasSvgRender() {
  return process.argv.includes('--include-christmas-svg');
}

async function main() {
  const includeChristmasSvg = includeChristmasSvgRender();
  const browser = await findBrowser();
  if (!browser) {
    console.error(
      'ERROR: no local Chrome/Edge executable found. Looked in:\n  ' +
        candidateBrowsers().join('\n  ') +
        '\nInstall Google Chrome or Microsoft Edge, or set CHROME_PATH to the executable.',
    );
    process.exit(1);
  }

  await fs.mkdir(ICONS_DIR, { recursive: true });
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feira-boa-icons-'));

  /** @param {string} faviconFile @param {typeof APP_ICON_TARGETS} targets */
  async function renderAppIcons(faviconFile, targets) {
    const faviconPath = path.join(ROOT, faviconFile);
    const raw = await fs.readFile(faviconPath, 'utf8');
    const mark = raw.replace(/<\?xml[^>]*\?>/g, '').trim();
    if (!mark.startsWith('<svg')) {
      throw new Error(`${faviconFile} does not look like an SVG document: ${faviconPath}`);
    }
    for (const target of targets) {
      await render(browser, tmpDir, { ...target, mark });
    }
  }

  const notificationSources = includeChristmasSvg
    ? NOTIFICATION_SOURCES
    : NOTIFICATION_SOURCES.filter((s) => s.faviconFile === 'favicon.svg');

  try {
    await renderAppIcons('favicon.svg', APP_ICON_TARGETS);
    if (includeChristmasSvg) {
      await renderAppIcons('favicon-christmas.svg', CHRISTMAS_APP_ICON_TARGETS);
    } else {
      console.log(
        'Skipping Christmas raster icons (use node scripts/export-christmas-icons-from-reference.mjs). ' +
          'Pass --include-christmas-svg to regenerate from favicon-christmas.svg.',
      );
    }
    for (const source of notificationSources) {
      const faviconPath = path.join(ROOT, source.faviconFile);
      const raw = await fs.readFile(faviconPath, 'utf8');
      const mark = raw.replace(/<\?xml[^>]*\?>/g, '').trim();
      if (!mark.startsWith('<svg')) {
        throw new Error(`${source.faviconFile} does not look like an SVG document: ${faviconPath}`);
      }
      await render(browser, tmpDir, { file: source.notificationFile, size: 96, kind: 'plain', mark });
      await render(browser, tmpDir, { file: source.badgeFile, size: 72, kind: 'plain', mark });
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
