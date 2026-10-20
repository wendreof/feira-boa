import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
import { assignIcon, classifyProduct, parseDateRange, slug, validateOffer } from "./common.mjs";

const DEFAULT_FLYER_URL = "https://bigbom.com.br/wp-content/uploads/2026/10/Big-Ofertas.pdf";
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

export async function extractBigBom(customUrl = null) {
  const flyerUrl = customUrl || DEFAULT_FLYER_URL;
  const res = await fetch(flyerUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not fetch Big Bom flyer (${res.status} ${res.statusText})`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const fullText = (await parser.getText()).text;

  // Extract dates
  const dateMatch = fullText.match(/OFERTAS V[AÁ]LIDAS DE\s*([^\n\r]+)/i);
  const validity = parseDateRange(dateMatch ? dateMatch[1] : "", 2026) || { from: "2026-10-19", to: "2026-10-22" };

  // Page 1 contains the product grid
  const page1 = fullText.split(/--\s*1 of \d+\s*--/i)[0];
  const cleaned = page1.replace(/^[\s\S]*?(?:ESTOQUES\.|OFERTAS V[AÁ]LIDAS[^\n]+)/i, "").trim();

  // Find all prices
  const priceRegex = /R\$\s*(\d+)\s*[,.]\s*(\d{2})/g;
  let matches = [];
  let m;
  while ((m = priceRegex.exec(cleaned)) !== null) {
    matches.push({
      str: m[0],
      price: parseFloat(`${m[1]}.${m[2]}`),
      index: m.index,
      length: m[0].length,
    });
  }

  let rawSegments = [];
  let lastIndex = 0;
  for (let i = 0; i < matches.length; i++) {
    const textSegment = cleaned.substring(lastIndex, matches[i].index).trim();
    rawSegments.push({
      text: textSegment,
      price: matches[i].price,
    });
    lastIndex = matches[i].index + matches[i].length;
  }

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
    const isConditionOnly = /^(?:NESTA OFERTA|A UNID\.?\s*SAI\s*POR|POR)\b/i.test(text);

    if (isConditionOnly) {
      if (offers.length > 0) {
        const lastOffer = offers[offers.length - 1];
        const conditionText = `${text} R$ ${seg.price.toFixed(2).replace(".", ",")}`;
        lastOffer.note = `${lastOffer.note ? `${lastOffer.note} · ` : ""}${conditionText}`.trim();
      }
      continue;
    }

    const parts = text.split(/\s*\|\s*|\s*\n\s*/).filter(Boolean);
    const fullName = parts.join(" ");

    const unitMatch = fullName.match(/(?:(?:Lata\s+)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|unids?\.?)|kg|unid\.?)$/i);
    const detail = unitMatch ? unitMatch[0].trim() : "Unidade";
    const nameOnly = fullName.replace(new RegExp(`\\s*${detail.replace(".", "\\.")}\\s*$`, "i"), "").trim();

    if (nameOnly.length < 2 || /NESTA OFERTA|A UNID\.?\s*SAI\s*POR/i.test(nameOnly)) continue;

    const taxonomy = classifyProduct(nameOnly, "", "Geral");
    const icon = assignIcon(nameOnly, taxonomy.productType, taxonomy.department);

    const offer = {
      id: `bigbom-${slug(`${nameOnly}-${detail}-${validity.from}`)}`,
      store: "Big Bom",
      storeLogo: "https://bigbom.com.br/wp-content/uploads/2024/11/Logo-Big-Bom-branca.png",
      branch: "Vila Zanetti · São João",
      name: nameOnly,
      brand: "",
      detail: detail,
      category: taxonomy.department,
      department: taxonomy.department,
      productType: taxonomy.productType,
      productTypes: taxonomy.productTypes,
      price: seg.price,
      previousPrice: null,
      icon,
      tone: "#edf4e9",
      note: "",
      validFrom: validity.from,
      validTo: validity.to,
      source: "Folheto oficial · São João da Boa Vista",
      sourceUrl: flyerUrl,
    };

    if (validateOffer(offer)) {
      offers.push(offer);
    }
  }

  return {
    storeId: "bigbom",
    store: {
      name: "Big Bom",
      branch: "Vila Zanetti · São João",
      logo: "https://bigbom.com.br/wp-content/uploads/2024/11/Logo-Big-Bom-branca.png",
      source: "Folheto oficial · São João da Boa Vista",
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
