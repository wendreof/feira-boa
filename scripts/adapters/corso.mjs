import { readFileSync, writeFileSync } from "node:fs";
import { classifyProduct } from "../domain/taxonomy.mjs";
import { mergeBrandIntoName } from "../domain/brands.mjs";
import { createOffer } from "./offer-factory.mjs";
import { fetchWithRetry } from "./http.mjs";
import { validateOffer } from "../domain/validation.mjs";
import { logoUrlForStoreId } from "../../src/shared/store-logos.mjs";
import {
  discoverCorsoFlyerFromHtml,
  capCorsoCampaignsToFrenteWeekend,
  extractCorsoFrenteWeekendWindow,
  latestValidityEnd,
  loadCorsoCampaignFile,
  parseCorsoFlyerText,
  parseCorsoValidityHints,
} from "../domain/corso-flyer.mjs";
import { ocrCorsoFlyerImages, ocrCorsoImageUrl } from "./corso-ocr.mjs";
import { extractCorsoCampaignsViaGemini, geminiExtractionEnabled } from "./corso-gemini.mjs";

const CORSO_URL = "https://corso.com.br/jornalfrente.php";
const CACHE_PATH = new URL("./data/corso-campaigns.json", import.meta.url);
const MIN_OFFERS_OCR = 35;
const MIN_OFFERS_GEMINI = 25;

const CORSO_STORE = {
  name: "Corso",
  logo: logoUrlForStoreId("corso"),
  branch: "Rua Eduardo Lopes Castilho, 495 · São João",
  source: "Folheto oficial · São João da Boa Vista",
};
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

function readCache() {
  return loadCorsoCampaignFile(JSON.parse(readFileSync(CACHE_PATH, "utf8")));
}

function writeCache({ flyerHash, campaigns, extractionMethod }) {
  writeFileSync(
    CACHE_PATH,
    `${JSON.stringify(
      {
        flyerHash,
        updatedAt: new Date().toISOString(),
        extractionMethod,
        campaigns,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function countOffers(campaigns) {
  return campaigns.reduce((sum, campaign) => sum + campaign.offers.length, 0);
}

function applyFrenteWeekendCap(campaigns, frenteOcr) {
  const window = extractCorsoFrenteWeekendWindow(frenteOcr);
  if (!window) return campaigns;
  return capCorsoCampaignsToFrenteWeekend(campaigns, window);
}

function ocrValidityIsNewerThanCache(ocrText, cache) {
  const hints = parseCorsoValidityHints(ocrText);
  if (hints.length === 0) return false;
  const ocrEnd = hints.reduce((max, range) => (range.to > max ? range.to : max), hints[0].to);
  const cacheEnd = latestValidityEnd(cache.campaigns);
  if (!cacheEnd) return true;
  return ocrEnd > cacheEnd;
}

function campaignsToOffers(campaigns, pageUrl) {
  const offers = [];
  let validFrom = null;
  let validTo = null;

  for (const campaign of campaigns) {
    validFrom = validFrom === null || campaign.from < validFrom ? campaign.from : validFrom;
    validTo = validTo === null || campaign.to > validTo ? campaign.to : validTo;

    for (const item of campaign.offers) {
      const name = mergeBrandIntoName(item.name, item.brand);
      const taxonomy = classifyProduct(name, item.cat, item.cat);
      const offer = createOffer({
        storeId: "corso",
        idKey: `${item.name}-${item.brand}-${item.detail}-${campaign.from}`,
        store: CORSO_STORE,
        sourceUrl: pageUrl,
        product: {
          name,
          detail: item.detail,
          storeCategory: item.cat,
          price: item.price,
          previousPrice: item.oldPrice,
        },
        validity: { from: campaign.from, to: campaign.to },
        taxonomy,
      });

      if (validateOffer(offer)) {
        offers.push(offer);
      }
    }
  }

  return { offers, validFrom, validTo };
}

async function resolveCampaigns(flyer, cache) {
  const frenteOcr = await ocrCorsoImageUrl(flyer.frenteUrl);
  const cacheIsCurrent =
    cache.flyerHash === flyer.hash &&
    cache.campaigns.length > 0 &&
    !ocrValidityIsNewerThanCache(frenteOcr, cache);

  if (cacheIsCurrent) {
    return {
      campaigns: applyFrenteWeekendCap(cache.campaigns, frenteOcr),
      extractionMethod: "cache",
    };
  }

  let campaigns = [];
  let extractionMethod = "ocr";

  if (geminiExtractionEnabled()) {
    try {
      campaigns = await extractCorsoCampaignsViaGemini(flyer);
      extractionMethod = "gemini";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Corso] Gemini extraction failed (${message}); trying OCR.`);
      campaigns = [];
      extractionMethod = "ocr";
    }
  }

  const geminiCount = countOffers(campaigns);
  if (geminiCount < MIN_OFFERS_GEMINI) {
    const ocrText = await ocrCorsoFlyerImages({
      frenteUrl: flyer.frenteUrl,
      versoUrl: flyer.versoUrl,
      frenteText: frenteOcr,
    });
    const parsed = parseCorsoFlyerText(ocrText);
    if (countOffers(parsed) > geminiCount) {
      campaigns = parsed;
      extractionMethod = "ocr";
    }
  }

  const total = countOffers(campaigns);
  const minRequired = extractionMethod === "gemini" ? MIN_OFFERS_GEMINI : MIN_OFFERS_OCR;
  if (total < minRequired) {
    const hint = geminiExtractionEnabled()
      ? "Extraction quality was too low."
      : "Set GEMINI_API_KEY (GitHub secret) for Corso vision extraction on image flyers.";
    throw new Error(
      `Corso flyer extraction incomplete (${total} offers, need at least ${minRequired}). ${hint}`,
    );
  }

  const capped = applyFrenteWeekendCap(campaigns, frenteOcr);
  writeCache({ flyerHash: flyer.hash, campaigns: capped, extractionMethod });
  return { campaigns: capped, extractionMethod };
}

export async function extractCorso(customUrl = null) {
  const pageUrl = customUrl || CORSO_URL;
  const res = await fetchWithRetry(pageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not fetch Corso flyer page (${res.status})`);
  const html = await res.text();

  const flyer = discoverCorsoFlyerFromHtml(html);
  if (!flyer) throw new Error("Could not discover Corso flyer image URLs in the official page.");

  const cache = readCache();
  const { campaigns, extractionMethod } = await resolveCampaigns(flyer, cache);
  const { offers, validFrom, validTo } = campaignsToOffers(campaigns, pageUrl);

  if (offers.length === 0) {
    throw new Error("Corso adapter produced zero valid offers after extraction.");
  }

  return {
    storeId: "corso",
    store: {
      name: CORSO_STORE.name,
      branch: CORSO_STORE.branch,
      logo: CORSO_STORE.logo,
      source: CORSO_STORE.source,
      sourceUrl: pageUrl,
      from: validFrom,
      to: validTo,
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: pageUrl,
    flyerHash: flyer.hash,
    extractionMethod,
    offers,
    status: "ok",
  };
}
