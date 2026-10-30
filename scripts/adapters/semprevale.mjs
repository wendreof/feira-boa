import { readFileSync } from "node:fs";
import { classifyProduct } from "../domain/taxonomy.mjs";
import { fetchWithRetry } from "./http.mjs";
import { validateOffer } from "../domain/validation.mjs";
import { createOffer } from "./offer-factory.mjs";

const SEMPREVALE_STORE = {
  name: "Sempre Vale",
  logo: "https://www.semprevale.com.br/images/logo-pequeno.png",
  branch: "Durval Nicolau",
  source: "Folheto oficial · Durval Nicolau",
};
const DURVAL_NICOLAU_ENDPOINT = "https://www.semprevale.com.br/get_unidades_ofertas.php";
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

// Manual transcription of the official flyer (campaign PDF). The flyer's text layer
// splits each price into separate glyph runs and places names in a visual grid, so
// automatic extraction mis-pairs names and prices. Offers are read from the flyer and
// kept in data/sempre-campaigns.json. If the store publishes a new flyer, the discovery
// check below stops the ingest (the previous snapshot is kept) until the JSON is updated.
const TRANSCRIPTION = JSON.parse(readFileSync(new URL("./data/sempre-campaigns.json", import.meta.url), "utf8"));

export async function extractSempreVale(customUrl = null) {
  const flyerUrl = customUrl || TRANSCRIPTION.flyerUrl;

  if (!customUrl) {
    const formRes = await fetchWithRetry(DURVAL_NICOLAU_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": USER_AGENT,
      },
      body: "id_cidade=4&bairro=Durval+Nicolau",
    });
    if (!formRes.ok) throw new Error(`Could not query Sempre Vale store page (${formRes.status})`);
    const html = await formRes.text();

    const pdfMatch = html.match(/href=["'](downloads\/ofertas\/[^"']+\.pdf)["']/i);
    if (!pdfMatch) throw new Error("Could not discover Sempre Vale flyer link in official page.");
    const currentFlyer = new URL(pdfMatch[1], "https://www.semprevale.com.br/").href;
    if (currentFlyer !== flyerUrl) {
      throw new Error(
        `Sempre Vale published a new flyer (${currentFlyer}). Re-transcribe scripts/adapters/data/sempre-campaigns.json before ingesting.`,
      );
    }
  }

  const offers = [];
  let validFrom = null;
  let validTo = null;

  for (const campaign of TRANSCRIPTION.campaigns) {
    validFrom = validFrom === null || campaign.from < validFrom ? campaign.from : validFrom;
    validTo = validTo === null || campaign.to > validTo ? campaign.to : validTo;

    for (const item of campaign.offers) {
      const taxonomy = classifyProduct(item.name, "Geral", item.cat);
      const offer = createOffer({
        storeId: "sempre",
        idKey: `${item.name}-${item.detail}-${campaign.from}`,
        store: SEMPREVALE_STORE,
        sourceUrl: flyerUrl,
        product: {
          name: item.name,
          detail: item.detail,
          price: item.price,
          previousPrice: item.oldPrice ?? null,
          note: item.note || "",
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
    storeId: "sempre",
    store: {
      name: SEMPREVALE_STORE.name,
      branch: SEMPREVALE_STORE.branch,
      logo: SEMPREVALE_STORE.logo,
      source: SEMPREVALE_STORE.source,
      sourceUrl: flyerUrl,
      from: validFrom,
      to: validTo,
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: flyerUrl,
    offers,
    status: "ok",
  };
}
