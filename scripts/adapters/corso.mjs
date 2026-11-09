import { readFileSync } from "node:fs";
import { classifyProduct } from "../domain/taxonomy.mjs";
import { mergeBrandIntoName } from "../domain/brands.mjs";
import { createOffer } from "./offer-factory.mjs";
import { fetchWithRetry } from "./http.mjs";
import { validateOffer } from "../domain/validation.mjs";
import { logoUrlForStoreId } from "../../src/shared/store-logos.mjs";

const CORSO_URL = "https://corso.com.br/jornalfrente.php";
const CORSO_STORE = {
  name: "Corso",
  logo: logoUrlForStoreId("corso"),
  branch: "Rua Eduardo Lopes Castilho, 495 · São João",
  source: "Folheto oficial · São João da Boa Vista",
};
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

// Manual transcription of the official flyer images (img/jornal-frente.jpg and
// img/jornal-verso.jpg). The page supplies only the change-detection hash; when
// it rotates, re-read both images and update the campaigns below. Sections keep
// their own validity because the flyer mixes windows (weekend, week, and
// long-running promo blocks).
const CAMPAIGNS = JSON.parse(readFileSync(new URL("./data/corso-campaigns.json", import.meta.url), "utf8"));

export async function extractCorso(customUrl = null) {
  const pageUrl = customUrl || CORSO_URL;
  const res = await fetchWithRetry(pageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not fetch Corso flyer page (${res.status})`);
  const html = await res.text();

  const hashMatch = html.match(/jornal-frente\.jpg\?hash=(\d+)/);
  const hash = hashMatch ? hashMatch[1] : "default";

  const offers = [];
  let validFrom = null;
  let validTo = null;

  for (const campaign of CAMPAIGNS) {
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
    flyerHash: hash,
    offers,
    status: "ok",
  };
}
