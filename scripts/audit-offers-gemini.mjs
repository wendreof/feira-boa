import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "./adapters/http.mjs";
import {
  campaignSchemaJson,
  geminiApiKey,
  generateFlyerCampaignsViaGemini,
  USER_AGENT,
} from "./adapters/gemini-flyer.mjs";
import { discoverCorsoFlyerFromHtml } from "./domain/corso-flyer.mjs";
import { discoverSpassoFlyersFromHtml } from "./domain/spasso-flyer.mjs";
import {
  compareOfferSets,
  describeFlyerHashAlignment,
  flattenCampaignOffers,
  hasCriticalIssues,
  sanityCheckCampaignFile,
} from "./domain/flyer-audit.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "scripts/adapters/data");
const MANIFEST_PATH = join(DATA_DIR, "gemini-audit-manifest.json");
const CORSO_URL = "https://corso.com.br/jornalfrente.php";
const SPASSO_URL = "https://spassosabores.com.br/ofertas-sao-joao/";
const MAX_AUDIT_IMAGES = 4;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readLocalImages(relPaths) {
  const limited = relPaths.slice(0, MAX_AUDIT_IMAGES);
  return limited.map((rel) => {
    const abs = join(ROOT, rel);
    const buffer = readFileSync(abs);
    const lower = rel.toLowerCase();
    const mime = lower.endsWith(".png") ? "image/png" : "image/jpeg";
    return { mime, data: buffer.toString("base64"), path: rel };
  });
}

async function fetchHtml(url) {
  const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
  return res.text();
}

async function auditHashStore({ storeId, pageUrl, cacheFile, discover }) {
  const html = await fetchHtml(pageUrl);
  const live = discover(html);
  const cache = readJson(join(DATA_DIR, cacheFile));
  const alignment = describeFlyerHashAlignment(live?.hash ?? null, cache.flyerHash ?? null);
  const sanity = sanityCheckCampaignFile(cache, { minOffers: 10, label: storeId });
  return {
    storeId,
    mode: "hash-skip-vision",
    alignment,
    sanity,
    offerCount: flattenCampaignOffers(cache).length,
  };
}

async function auditFortemixVision(manifest, apiKeyPresent) {
  const cfg = manifest.fortemix ?? {};
  const campaignPath = join(DATA_DIR, cfg.campaignsFile ?? "fortemix-campaigns.json");
  const reference = readJson(campaignPath);
  const sanity = sanityCheckCampaignFile(reference, {
    minOffers: cfg.minOffers ?? 15,
    label: "fortemix",
  });
  const imagePaths = Array.isArray(cfg.auditImagePaths) ? cfg.auditImagePaths : [];
  const entry = {
    storeId: "fortemix",
    campaignId: reference.campaignId ?? null,
    sanity,
    vision: { status: "skipped", reason: "no audit images in manifest" },
  };

  if (imagePaths.length === 0 || !apiKeyPresent) {
    if (imagePaths.length > 0 && !apiKeyPresent) {
      entry.vision = { status: "skipped", reason: "GEMINI_API_KEY not set" };
    }
    return entry;
  }

  const images = readLocalImages(imagePaths);
  const prompt = [
    "Transcribe this Forte Mix supermarket flyer into structured JSON.",
    "Extract every priced product. Brazilian prices as numbers (4,98 => 4.98).",
    "Return ONLY JSON matching:",
    campaignSchemaJson(["Hortifruti"]),
  ].join("\n");

  const extractedCampaigns = await generateFlyerCampaignsViaGemini({
    prompt,
    images,
    modelEnvKeys: ["GEMINI_AUDIT_MODEL", "GEMINI_MODEL"],
    errorLabel: "ForteMix audit",
    timeoutMs: 120_000,
  });
  const comparison = compareOfferSets(
    flattenCampaignOffers(reference),
    flattenCampaignOffers({ campaigns: extractedCampaigns }),
  );
  entry.vision = {
    status: comparison.criticalCount === 0 ? "ok" : "mismatch",
    images: imagePaths.slice(0, MAX_AUDIT_IMAGES),
    ...comparison,
  };
  if (comparison.criticalCount > 0) {
    entry.sanity.push({
      level: "critical",
      message: `Gemini re-read disagrees with manual cache (${comparison.criticalCount} critical diffs).`,
    });
  }
  return entry;
}

function collectIssues(report) {
  const issues = [];
  for (const store of report.stores) {
    if (store.alignment) issues.push(store.alignment);
    for (const item of store.sanity ?? []) issues.push(item);
    if (store.vision?.status === "mismatch") {
      issues.push({ level: "critical", message: `${store.storeId}: vision mismatch` });
    }
  }
  return issues;
}

async function main() {
  const manifest = readJson(MANIFEST_PATH);
  const apiKeyPresent = geminiApiKey().length > 0;
  const report = {
    ranAt: new Date().toISOString(),
    geminiEnabled: apiKeyPresent,
    modelEnvKeys: ["GEMINI_AUDIT_MODEL", "GEMINI_MODEL"],
    stores: [],
  };

  report.stores.push(
    await auditHashStore({
      storeId: "corso",
      pageUrl: CORSO_URL,
      cacheFile: "corso-campaigns.json",
      discover: discoverCorsoFlyerFromHtml,
    }),
  );
  report.stores.push(
    await auditHashStore({
      storeId: "spasso",
      pageUrl: SPASSO_URL,
      cacheFile: "spasso-campaigns.json",
      discover: discoverSpassoFlyersFromHtml,
    }),
  );
  report.stores.push(await auditFortemixVision(manifest, apiKeyPresent));

  const outPath = join(ROOT, "gemini-audit-report.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);

  const issues = collectIssues(report);
  for (const issue of issues) {
    console.log(`[${issue.level}] ${issue.message}`);
  }

  if (hasCriticalIssues(issues)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});