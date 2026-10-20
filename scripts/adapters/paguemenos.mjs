import { assignIcon, classifyProduct, slug, validateOffer } from "./common.mjs";

const PAGUE_MENOS_URL = "https://www.superpaguemenos.com.br/jornal-de-ofertas/";
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

function getWeekValidity() {
  const now = new Date();
  const spDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  // Extend to next Sunday
  const today = new Date(`${spDate}T12:00:00Z`);
  const dayOfWeek = today.getUTCDay(); // 0 is Sunday
  const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
  const sunday = new Date(today.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000);
  const sundayStr = sunday.toISOString().slice(0, 10);

  return { from: spDate, to: sundayStr };
}

export async function extractPagueMenos(customUrl = null) {
  const pageUrl = customUrl || PAGUE_MENOS_URL;
  const res = await fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not fetch Pague Menos offers page (${res.status})`);
  const html = await res.text();

  const validity = getWeekValidity();

  const productForms = [...html.matchAll(/data-json='([^']+)'/gi)];
  const offers = [];

  for (const [, jsonStr] of productForms) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.item_name || !data.price || data.price <= 0) continue;

      const fullName = String(data.item_name).trim();
      const brand = String(data.item_brand || "").trim();

      // Extract unit/detail from name (e.g. "720g", "1,8l", "750ml", etc.)
      const unitMatch = fullName.match(/(?:\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|unids?\.?))$/i);
      const detail = unitMatch ? unitMatch[0].trim() : "Unidade";
      const nameOnly = fullName.replace(new RegExp(`\\s*${detail.replace(".", "\\.")}\\s*$`, "i"), "").trim();

      const taxonomy = classifyProduct(nameOnly, brand, data.item_category1 || "Mercearia");
      const icon = assignIcon(nameOnly, taxonomy.productType, taxonomy.department);

      const offer = {
        id: `paguemenos-${slug(`${nameOnly}-${brand}-${detail}-${validity.from}`)}`,
        store: "Pague Menos",
        storeLogo: "https://yata-apix-ffbe8645-e2d3-4333-a3d7-a50dd75a9365.s3-object.locaweb.com.br/26b38c95de59446292057c272a15e0c2.png",
        branch: "Loja 33 · Jardim Santo André",
        name: nameOnly,
        brand,
        detail,
        category: taxonomy.department,
        department: taxonomy.department,
        productType: taxonomy.productType,
        productTypes: taxonomy.productTypes,
        price: Number(data.price),
        previousPrice: null,
        icon,
        tone: "#edf4e9",
        note: "Preço online oficial; pode variar na loja física",
        validFrom: validity.from,
        validTo: validity.to,
        source: "Ofertas online oficiais · Loja 33",
        sourceUrl: pageUrl,
      };

      if (validateOffer(offer)) {
        offers.push(offer);
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return {
    storeId: "paguemenos",
    store: {
      name: "Pague Menos",
      branch: "Loja 33 · Jardim Santo André",
      logo: "https://yata-apix-ffbe8645-e2d3-4333-a3d7-a50dd75a9365.s3-object.locaweb.com.br/26b38c95de59446292057c272a15e0c2.png",
      source: "Ofertas online oficiais · Loja 33",
      sourceUrl: pageUrl,
      from: validity.from,
      to: validity.to,
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: pageUrl,
    offers,
    status: "ok",
  };
}
