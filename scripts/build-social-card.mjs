#!/usr/bin/env node
/**
 * Renders social-card.png (1200x630) at the repo root.
 *
 * The card is rendered from an inlined HTML document (brand mark inlined from
 * favicon.svg) and screenshotted with a locally installed Chrome/Edge in
 * headless mode. No npm dependency is required.
 *
 * Usage: node scripts/build-social-card.mjs
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
const FAVICON = path.join(ROOT, 'favicon.svg');
const OUTPUT = path.join(ROOT, 'social-card.png');

const WIDTH = 1200;
const HEIGHT = 630;
const CHROME_TIMEOUT_MS = 60_000;

const COLORS = {
  green: '#155b3b',
  mint: '#c9f27b',
  cream: '#f7f4df',
  paper: '#f5f6f1',
  ink: '#19261f',
  muted: '#5c6b61',
};

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

function buildHtml(brandMark) {
  const fontStack = `'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    overflow: hidden;
    background: ${COLORS.paper};
    font-family: ${fontStack};
    -webkit-font-smoothing: antialiased;
  }
  .accent-bar {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 9px;
    background: linear-gradient(90deg, ${COLORS.green} 0%, #43b06f 45%, #f1c75b 82%, #f1c75b 100%);
  }
  .blob {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }
  .blob.top-right {
    width: 460px; height: 460px;
    top: -210px; right: -150px;
    background: #e7f5e9;
  }
  .card {
    position: absolute;
    inset: 0;
    padding: 62px 84px 58px;
    display: flex;
    flex-direction: column;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 22px;
  }
  .brand-mark {
    width: 112px;
    height: 112px;
    flex: 0 0 auto;
    display: block;
    filter: drop-shadow(0 12px 26px #155b3b3d);
  }
  .brand-mark svg { display: block; width: 100%; height: 100%; }
  .brand-text { display: flex; flex-direction: column; gap: 6px; }
  .wordmark {
    font-size: 46px;
    font-weight: 800;
    letter-spacing: -1.6px;
    line-height: 1;
    color: ${COLORS.ink};
  }
  .wordmark .accent { color: ${COLORS.green}; }
  .brand-sub {
    font-size: 18px;
    font-weight: 600;
    color: ${COLORS.muted};
    letter-spacing: .2px;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    align-self: flex-start;
    margin-top: 30px;
    padding: 9px 18px;
    border-radius: 999px;
    background: #eaf3e6;
    color: ${COLORS.green};
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .eyebrow .dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    background: #65b676;
  }
  .rule {
    width: 108px;
    height: 8px;
    border-radius: 999px;
    background: ${COLORS.mint};
    margin: 22px 0 20px;
  }
  h1 {
    margin: 0;
    max-width: 900px;
    font-size: 66px;
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -2.4px;
    color: ${COLORS.green};
  }
  .sub {
    margin: 18px 0 0;
    font-size: 25px;
    line-height: 1.4;
    font-weight: 500;
    color: ${COLORS.muted};
    white-space: nowrap;
  }
  .foot {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }
  .domain {
    display: inline-flex;
    align-items: center;
    padding: 15px 30px;
    border-radius: 999px;
    background: ${COLORS.green};
    color: ${COLORS.cream};
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -.2px;
  }
  .tag {
    font-size: 19px;
    font-weight: 700;
    color: ${COLORS.green};
    background: ${COLORS.cream};
    border: 1px solid #e6e0c6;
    border-radius: 999px;
    padding: 11px 22px;
  }
</style>
</head>
<body>
  <div class="blob top-right"></div>
  <main class="card">
    <div>
      <div class="brand">
        <div class="brand-mark">${brandMark}</div>
        <div class="brand-text">
          <div class="wordmark">feira <span class="accent">boa</span></div>
          <div class="brand-sub">São João da Boa Vista, SP</div>
        </div>
      </div>
    </div>
    <div>
      <span class="eyebrow"><span class="dot"></span>Ofertas de supermercados</span>
      <div class="rule"></div>
      <h1>Ofertas em São João<br>da Boa Vista</h1>
      <p class="sub">Compare preços, filtre por loja e acompanhe as ofertas da semana.</p>
    </div>
    <div class="foot">
      <span class="domain">feira-boa.pages.dev</span>
      <span class="tag">Preços dos folhetos oficiais</span>
    </div>
  </main>
  <div class="accent-bar"></div>
</body>
</html>
`;
}

function readPngSize(file) {
  const buffer = fsSync.readFileSync(file);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error('Output file is not a valid PNG');
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function main() {
  const browser = await findBrowser();
  if (!browser) {
    console.error(
      'ERROR: no local Chrome/Edge executable found. Looked in:\n  ' +
        candidateBrowsers().join('\n  ') +
        '\nInstall Google Chrome or Microsoft Edge, or set CHROME_PATH to the executable.',
    );
    process.exit(1);
  }

  const rawMark = await fs.readFile(FAVICON, 'utf8');
  const brandMark = rawMark.replace(/<\?xml[^>]*\?>/g, '').trim();
  if (!brandMark.startsWith('<svg')) {
    throw new Error(`favicon.svg does not look like an SVG document: ${FAVICON}`);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feira-boa-social-card-'));
  const htmlPath = path.join(tmpDir, 'social-card.html');
  const profileDir = path.join(tmpDir, 'chrome-profile');
  const shotPath = path.join(tmpDir, 'social-card.png');

  try {
    await fs.writeFile(htmlPath, buildHtml(brandMark), 'utf8');

    const args = [
      '--headless=new',
      `--screenshot=${shotPath}`,
      `--window-size=${WIDTH},${HEIGHT}`,
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
    if (width !== WIDTH || height !== HEIGHT) {
      throw new Error(
        `Screenshot is ${width}x${height}, expected ${WIDTH}x${HEIGHT}. Refusing to write the card.`,
      );
    }

    await fs.copyFile(shotPath, OUTPUT);
    const out = await fs.stat(OUTPUT);
    console.log(`Wrote ${path.relative(ROOT, OUTPUT)} (${width}x${height}, ${out.size} bytes)`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
