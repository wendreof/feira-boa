import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Tesseract from "tesseract.js";
import { fetchWithRetry } from "./http.mjs";

const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

async function downloadImage(url) {
  const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not download Corso flyer image (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

function runCliTesseract(imagePath) {
  return new Promise((resolve, reject) => {
    const child = spawn("tesseract", [imagePath, "stdout", "-l", "por", "--psm", "6"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `tesseract exited ${code}`));
    });
  });
}

async function ocrWithCli(buffer) {
  const dir = await mkdtemp(join(tmpdir(), "corso-ocr-"));
  const imagePath = join(dir, "flyer.jpg");
  try {
    await writeFile(imagePath, buffer);
    return await runCliTesseract(imagePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function ocrWithTesseractJs(buffer) {
  const worker = await Tesseract.createWorker("por");
  try {
    const { data } = await worker.recognize(buffer);
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

export async function ocrCorsoImageUrl(url) {
  const buffer = await downloadImage(url);
  if (process.env.CORSO_TESSERACT_JS_ONLY !== "1") {
    try {
      return await ocrWithCli(buffer);
    } catch {
      // Fall back to WASM build when the runner has no native tesseract binary.
    }
  }
  return ocrWithTesseractJs(buffer);
}

export async function ocrCorsoFlyerImages({ frenteUrl, versoUrl, frenteText = null }) {
  const [frente, versoText] = await Promise.all([
    frenteText ? Promise.resolve(frenteText) : ocrCorsoImageUrl(frenteUrl),
    ocrCorsoImageUrl(versoUrl),
  ]);
  return `${frente}\n\n--- VERSO ---\n\n${versoText}`.trim();
}
