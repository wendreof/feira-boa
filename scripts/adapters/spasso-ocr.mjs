import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Tesseract from "tesseract.js";
import { labelSpassoFlyerImage } from "../domain/spasso-flyer.mjs";
import { fetchWithRetry } from "./http.mjs";

const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

async function downloadImage(url) {
  const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not download Spasso flyer image (${res.status})`);
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
  const dir = await mkdtemp(join(tmpdir(), "spasso-ocr-"));
  const imagePath = join(dir, "flyer.png");
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

export async function ocrSpassoImageUrl(url) {
  const buffer = await downloadImage(url);
  if (process.env.SPASSO_TESSERACT_JS_ONLY !== "1") {
    try {
      return await ocrWithCli(buffer);
    } catch {
      // Fall back to WASM when the runner has no native tesseract binary.
    }
  }
  return ocrWithTesseractJs(buffer);
}

/** @param {string[]} imageUrls */
export async function ocrSpassoFlyerImages(imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("Spasso OCR requires at least one flyer image URL.");
  }
  const parts = [];
  for (const url of imageUrls) {
    const label = labelSpassoFlyerImage(url);
    const text = await ocrSpassoImageUrl(url);
    parts.push(`--- ${label} ---\n\n${text.trim()}`);
  }
  return parts.join("\n\n").trim();
}