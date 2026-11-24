import { readFileSync, writeFileSync } from "node:fs";
import { classifyProduct } from "../domain/taxonomy.mjs";
import { mergeBrandIntoName } from "../domain/brands.mjs";
import { createOffer } from "./offer-factory.mjs";
import { fetchWithRetry } from "./http.mjs";
import { validateOffer } from "../domain/validation.mjs";
import { logoUrlForStoreId } from "../../src/shared/store-logos.mjs";
import {
  defaultSpassoValidityWindow,
  discoverSpassoFlyersFromHtml,
  loadSpassoCampaignFile,
} from "../domain/spasso-flyer.mjs";
import {
  isSpassoSectionBannerName,
  spassoCampaignOfferValidity,
} from "../domain/spasso-weekday-validity.mjs";
import { isTransientGeminiError } from "./gemini-flyer.mjs";
import { extractSpassoCampaignsViaGemini, geminiExtractionEnabled } from "./spasso-gemini.mjs";
import { ocrSpassoFlyerImages } from "./spasso-ocr.mjs";
import { parseSpassoFlyerOcrText, pickSpassoExtractionWinner } from "../domain/spasso-flyer-ocr.mjs";

const SPASSO_URL = "https://spassosabores.com.br/ofertas-sao-joao/";
const CACHE_PATH = new URL("./data/spasso-campaigns.json", import.meta.url);
const MIN_OFFERS_GEMINI = 20;
const MIN_OFFERS_OCR = 8;

const SPASSO_STORE = {
  name: "Spasso Sabores",
  logo: logoUrlForStoreId("spasso"),
  branch: "Av. Dr. Durval Nicolau, 1572 · São João",
  source: "Folheto oficial · Loja São João",
};
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

function readCache() {
  return loadSpassoCampaignFile(JSON.parse(readFileSync(CACHE_PATH, "utf8")));
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

function campaignsToOffers(campaigns, pageUrl, flyerImageUrls = []) {
  const offers = [];
  let validFrom = null;
  let validTo = null;

  for (const campaign of campaigns) {
    const validity = spassoCampaignOfferValidity(campaign, flyerImageUrls);
    validFrom = validFrom === null || validity.from < validFrom ? validity.from : validFrom;
    validTo = validTo === null || validity.to > validTo ? validity.to : validTo;

    for (const item of campaign.offers) {
      const name = mergeBrandIntoName(item.name, item.brand);
      if (isSpassoSectionBannerName(name)) continue;
      const taxonomy = classifyProduct(name, item.cat, item.cat);
      const offer = createOffer({
        storeId: "spasso",
        idKey: `${item.name}-${item.brand}-${item.detail}-${campaign.from ?? validity.from}`,
        store: SPASSO_STORE,
        sourceUrl: pageUrl,
        product: {
          name,
          detail: item.detail,
          storeCategory: item.cat,
          price: item.price,
          previousPrice: item.oldPrice,
        },
        validity: { from: validity.from, to: validity.to, validWeekdays: validity.validWeekdays },
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
  if (cache.flyerHash === flyer.hash && cache.campaigns.length > 0) {
    return { campaigns: cache.campaigns, extractionMethod: "cache" };
  }

  let ocrCampaigns = [];
  try {
    const ocrText = await ocrSpassoFlyerImages(flyer.imageUrls);
    ocrCampaigns = parseSpassoFlyerOcrText(ocrText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Spasso Sabores] OCR failed (${message}); continuing without OCR.`);
  }

  let geminiCampaigns = null;
  if (geminiExtractionEnabled() && countOffers(ocrCampaigns) < MIN_OFFERS_GEMINI) {
    try {
      geminiCampaigns = await extractSpassoCampaignsViaGemini(flyer.imageUrls);
    } catch (error) {
      const transient = isTransientGeminiError(error);
      const message = error instanceof Error ? error.message : String(error);
      if (transient) {
        console.warn(`[Spasso Sabores] Gemini rate-limited (${message}); using OCR or cache fallback.`);
      } else {
        console.warn(`[Spasso Sabores] Gemini extraction failed (${message}); using OCR if sufficient.`);
      }
      if (transient && countOffers(ocrCampaigns) < MIN_OFFERS_OCR && cache.campaigns.length > 0) {
        writeCache({
          flyerHash: flyer.hash,
          campaigns: cache.campaigns,
          extractionMethod: "cache_stale_hash",
        });
        return { campaigns: cache.campaigns, extractionMethod: "cache_stale_hash" };
      }
      if (!transient) {
        throw error;
      }
    }
  }

  const { campaigns, extractionMethod } = pickSpassoExtractionWinner({
    ocr: ocrCampaigns,
    gemini: geminiCampaigns,
    minGemini: MIN_OFFERS_GEMINI,
  });

  const total = countOffers(campaigns);
  const minRequired =
    extractionMethod === "gemini" ? MIN_OFFERS_GEMINI : Math.min(MIN_OFFERS_OCR, MIN_OFFERS_GEMINI);

  if (total < minRequired) {
    if (cache.campaigns.length > 0) {
      console.warn(
        "[Spasso Sabores] Extraction incomplete; reusing last transcription with updated flyer hash.",
      );
      writeCache({
        flyerHash: flyer.hash,
        campaigns: cache.campaigns,
        extractionMethod: "cache_stale_hash",
      });
      return { campaigns: cache.campaigns, extractionMethod: "cache_stale_hash" };
    }
    if (!geminiExtractionEnabled()) {
      return {
        campaigns: [],
        extractionMethod: "skipped_no_api_key",
        skipReason:
          "GEMINI_API_KEY is not set and OCR did not yield enough offers. Set the key or improve OCR.",
      };
    }
    throw new Error(
      `Spasso flyer extraction incomplete (${total} offers, need at least ${minRequired}).`,
    );
  }

  writeCache({ flyerHash: flyer.hash, campaigns, extractionMethod });
  return { campaigns, extractionMethod };
}

export async function extractSpasso(customUrl = null) {
  let pageUrl = customUrl?.trim() || SPASSO_URL;
  if (!pageUrl.startsWith("http")) {
    pageUrl = new URL(pageUrl, "https://spassosabores.com.br/").href;
  }
  const res = await fetchWithRetry(pageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not fetch Spasso page (${res.status})`);
  const html = await res.text();

  const flyer = discoverSpassoFlyersFromHtml(html);
  if (!flyer) throw new Error("Could not discover Spasso flyer image URLs on the official page.");

  const cache = readCache();
  const { campaigns, extractionMethod, skipReason } = await resolveCampaigns(flyer, cache);

  if (campaigns.length === 0) {
    if (skipReason) {
      console.warn(`[Spasso Sabores] ${skipReason}`);
    }
    const validity = defaultSpassoValidityWindow();
    return {
      storeId: "spasso",
      store: {
        name: SPASSO_STORE.name,
        branch: SPASSO_STORE.branch,
        logo: SPASSO_STORE.logo,
        source: SPASSO_STORE.source,
        sourceUrl: pageUrl,
        from: validity.from,
        to: validity.to,
      },
      fetchedAt: new Date().toISOString(),
      sourceUrl: pageUrl,
      flyerHash: flyer.hash,
      flyerImages: flyer.imageUrls,
      extractionMethod,
      offers: [],
      status: "image_flyer_pending_transcription",
    };
  }

  const { offers, validFrom, validTo } = campaignsToOffers(campaigns, pageUrl, flyer.imageUrls);
  if (offers.length === 0) {
    throw new Error("Spasso adapter produced zero valid offers after extraction.");
  }

  return {
    storeId: "spasso",
    store: {
      name: SPASSO_STORE.name,
      branch: SPASSO_STORE.branch,
      logo: SPASSO_STORE.logo,
      source: SPASSO_STORE.source,
      sourceUrl: pageUrl,
      from: validFrom,
      to: validTo,
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: pageUrl,
    flyerHash: flyer.hash,
    flyerImages: flyer.imageUrls,
    extractionMethod,
    offers,
    status: "ok",
  };
}
