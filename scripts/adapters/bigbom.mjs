import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
import { classifyProduct } from "../domain/taxonomy.mjs";
import { fetchWithRetry } from "./http.mjs";
import { parseDateRange } from "../domain/parsing.mjs";
import { validateOffer } from "../domain/validation.mjs";
import { createOffer } from "./offer-factory.mjs";

const BIGBOM_STORE = {
  name: "Big Bom",
  logo: "https://bigbom.com.br/wp-content/uploads/2024/11/Logo-Big-Bom-branca.png",
  branch: "Vila Zanetti · São João",
  source: "Folheto oficial · São João da Boa Vista",
};

const DEFAULT_FLYER_URL = "https://bigbom.com.br/wp-content/uploads/2026/10/Big-Ofertas.pdf";
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

export async function extractBigBom(customUrl = null) {
  const flyerUrl = customUrl || DEFAULT_FLYER_URL;
  const res = await fetchWithRetry(flyerUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not fetch Big Bom flyer (${res.status} ${res.statusText})`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const fullText = (await parser.getText()).text;

  // Extract dates
  const dateMatch = fullText.match(/OFERTAS V[AÁ]LIDAS DE\s*([^\n\r]+)/i);
  const validity = parseDateRange(dateMatch ? dateMatch[1] : "", 2026);
  if (!validity) throw new Error("Could not read the Big Bom flyer validity dates.");

  const priceRegex = /R\$\s*(\d+)\s*[,.]\s*(\d{2})/g;

  function segmentPrices(text) {
    const matches = [];
    let match;
    priceRegex.lastIndex = 0;
    while ((match = priceRegex.exec(text)) !== null) {
      matches.push({
        price: parseFloat(`${match[1]}.${match[2]}`),
        index: match.index,
        length: match[0].length,
      });
    }
    const segments = [];
    let lastIndex = 0;
    for (const priced of matches) {
      segments.push({
        text: text.slice(lastIndex, priced.index).trim(),
        price: priced.price,
      });
      lastIndex = priced.index + priced.length;
    }
    return segments;
  }

  // Older flyers keep a banner ("... ESTOQUES." / "OFERTAS VÁLIDAS ...") above a
  // single first-page grid. Newer ones spread the grid over several pages, label
  // each section (DESTAQUES / COMBOS / OFERTAS) and end pages with the validity
  // line, so the legacy strip would wipe the whole page. Process every page and
  // keep whichever form still contains prices; text after the last price of a
  // page (footers, addresses, legal) is dropped by construction.
  function pageSegments(pageText) {
    const legacyStripped = pageText.replace(/^[\s\S]*?(?:ESTOQUES\.|OFERTAS V[AÁ]LIDAS[^\n]+)/i, "").trim();
    const legacy = legacyStripped === pageText.trim() ? [] : segmentPrices(legacyStripped);
    if (legacy.length > 0) return legacy;
    return segmentPrices(pageText.replace(/^\s*(?:DESTAQUES|COMBOS|OFERTAS)\b/i, "").trim());
  }

  const rawSegments = fullText
    .split(/--\s*\d+ of \d+\s*--/i)
    .flatMap((page) => pageSegments(page));

  const offers = [];

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    let text = seg.text.replace(/\s+/g, " ").trim();
    text = text.replace(/^(?:\d+\s+A\s+\d+[^.]*ESTOQUES\.\s*)/i, "").trim();

    // Bundle trailers like "LEVE 8", "PAGUE 3 LEVE 4"
    const bundlePrefixMatch = text.match(/^(?:(?:LEVE|PAGUE)\s+\d+(?:\s*(?:E|,)?\s*(?:LEVE|PAGUE)\s+\d+)?)\s+/i);
    if (bundlePrefixMatch) {
      if (offers.length > 0) {
        const lastOffer = offers[offers.length - 1];
        lastOffer.note = `${lastOffer.note ? `${lastOffer.note} · ` : ""}${bundlePrefixMatch[0].trim()}`.trim();
      }
      text = text.slice(bundlePrefixMatch[0].length).trim();
    }

    // Promotional condition clauses
    const isConditionOnly = /^(?:NESTA (?:OFERTA|EMBALAGEM)|A UNID\.?\s*SAI\s*POR|POR)\b/i.test(text);

    if (isConditionOnly) {
      if (offers.length > 0) {
        const lastOffer = offers[offers.length - 1];
        const conditionText = `${text} R$ ${seg.price.toFixed(2).replace(".", ",")}`;
        lastOffer.note = `${lastOffer.note ? `${lastOffer.note} · ` : ""}${conditionText}`.trim();
      }
      continue;
    }

    // Size-price tables (e.g. "72 70 60 ... P M G XG") leak into the segment of
    // the next product on some grids; drop that leading run before the name.
    text = text.replace(/^(?:(?:\d{1,3}|XXXG|XXG|XG|[PMG])\s+)+/i, "").trim();

    const parts = text.split(/\s*\|\s*|\s*\n\s*/).filter(Boolean);
    const fullName = parts.join(" ");

    const unitMatch = fullName.match(/(?:(?:Lata\s+)?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?\s*(?:kg|g|ml|l|unids?\.?)|kg|unid\.?)$/i);
    const detail = unitMatch ? unitMatch[0].trim() : "Unidade";
    const nameOnly = fullName.replace(new RegExp(`\\s*${detail.replace(".", "\\.")}\\s*$`, "i"), "").trim();

    if (nameOnly.length < 2 || /NESTA OFERTA|A UNID\.?\s*SAI\s*POR/i.test(nameOnly)) continue;

    const taxonomy = classifyProduct(nameOnly, "Geral");
    const offer = createOffer({
      storeId: "bigbom",
      idKey: `${nameOnly}-${detail}-${validity.from}`,
      store: BIGBOM_STORE,
      sourceUrl: flyerUrl,
      product: { name: nameOnly, detail, price: seg.price },
      validity,
      taxonomy,
    });

    if (validateOffer(offer)) {
      offers.push(offer);
    }
  }

  return {
    storeId: "bigbom",
    store: {
      name: BIGBOM_STORE.name,
      branch: BIGBOM_STORE.branch,
      logo: BIGBOM_STORE.logo,
      source: BIGBOM_STORE.source,
      sourceUrl: flyerUrl,
      from: validity.from,
      to: validity.to,
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: flyerUrl,
    offers,
    status: "ok",
  };
}
