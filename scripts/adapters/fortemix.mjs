import { readFileSync } from "node:fs";
import { classifyProduct } from "../domain/taxonomy.mjs";
import { mergeBrandIntoName } from "../domain/brands.mjs";
import { createOffer } from "./offer-factory.mjs";
import { validateOffer } from "../domain/validation.mjs";
import { logoUrlForStoreId } from "../../src/shared/store-logos.mjs";

const FORTE_MIX_URL = "https://smfortemix.com.br/";
const FORTE_MIX_STORE = {
  name: "Forte Mix",
  logo: logoUrlForStoreId("fortemix"),
  branch: "Rede Forte · SJBV e região",
  source: "Folheto Forte Mix · app e Dezcontão",
};

// Manual transcription of the Festival Felitá images shared on WhatsApp.
// When a new campaign arrives, replace scripts/adapters/data/fortemix-campaigns.json
// and bump campaignId so ingest logs the rotation.
const TRANSCRIPTION = JSON.parse(
  readFileSync(new URL("./data/fortemix-campaigns.json", import.meta.url), "utf8"),
);

export async function extractForteMix() {
  const offers = [];
  let validFrom = null;
  let validTo = null;

  for (const campaign of TRANSCRIPTION.campaigns) {
    validFrom = validFrom === null || campaign.from < validFrom ? campaign.from : validFrom;
    validTo = validTo === null || campaign.to > validTo ? campaign.to : validTo;

    for (const item of campaign.offers) {
      const name = mergeBrandIntoName(item.name, item.brand);
      const taxonomy = classifyProduct(name, item.cat, item.cat);
      const offer = createOffer({
        storeId: "fortemix",
        idKey: `${item.name}-${item.detail}-${campaign.from}`,
        store: FORTE_MIX_STORE,
        sourceUrl: TRANSCRIPTION.sourceUrl || FORTE_MIX_URL,
        product: {
          name,
          detail: item.detail,
          storeCategory: item.cat,
          price: item.price,
          previousPrice: item.oldPrice ?? null,
          note: item.note ?? campaign.offerNote ?? "",
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
    storeId: "fortemix",
    store: {
      name: FORTE_MIX_STORE.name,
      branch: FORTE_MIX_STORE.branch,
      logo: FORTE_MIX_STORE.logo,
      source: FORTE_MIX_STORE.source,
      sourceUrl: TRANSCRIPTION.sourceUrl || FORTE_MIX_URL,
      from: validFrom,
      to: validTo,
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: TRANSCRIPTION.sourceUrl || FORTE_MIX_URL,
    campaignId: TRANSCRIPTION.campaignId,
    offers,
    status: "ok",
  };
}
