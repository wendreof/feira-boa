import { parseDateRange, parsePrice } from "./parsing.mjs";
import { foldText } from "../../src/shared/text.mjs";
import { loadFlyerCampaignFile } from "./flyer-campaign-cache.mjs";
import { decodeHtmlEntities } from "./html-entities.mjs";

const CORSO_ORIGIN = "https://corso.com.br/";

export function discoverCorsoFlyerFromHtml(html) {
  if (!html || typeof html !== "string") return null;
  const decoded = decodeHtmlEntities(html);
  const frenteMatch = decoded.match(/src=["']img\/jornal-frente\.jpg\?hash=(\d+)["']/i)
    || decoded.match(/jornal-frente\.jpg\?hash=(\d+)/i);
  const hash = frenteMatch?.[1] ?? null;
  if (!hash) return null;
  return {
    hash,
    frenteUrl: new URL(`img/jornal-frente.jpg?hash=${hash}`, CORSO_ORIGIN).href,
    versoUrl: new URL(`img/jornal-verso.jpg?hash=${hash}`, CORSO_ORIGIN).href,
    pageUrl: new URL("jornalfrente.php", CORSO_ORIGIN).href,
  };
}

const VALIDITY_LINE =
  /ofertas?\s+v[aá]lidas?\s*:?\s*[^.\n]{0,200}?(?:\d{1,2}\s*[/e]\s*\d{1,2}[/\d]*|\d{1,2}\s+de\s+[a-z]+)/gi;

const SKIP_TOKENS = new Set([
  "de", "por", "ou", "ate", "até", "em", "no", "na", "do", "da", "dos", "das",
  "leve", "pague", "unid", "unidade", "unidades", "kg", "pct", "cx",
  "ofertas", "validas", "válidas", "sexta", "sabado", "sábado", "domingo",
  "quinta", "segunda", "terca", "terça", "quarta", "promocao", "promoção",
  "frutas", "legumes", "verduras", "mercearia", "bebidas", "limpeza",
  "acougue", "açougue", "frios", "laticinios", "laticínios", "congelados",
]);

function extractPricesFromLine(line) {
  const prices = [];
  const re = /R\$\s*(\d+)\s*[,.]\s*(\d{2})/gi;
  let match;
  while ((match = re.exec(line)) !== null) {
    prices.push(parseFloat(`${match[1]}.${match[2]}`));
  }
  return prices;
}

function tokenizeProductLine(line) {
  const cleaned = line
    .replace(/R\$\s*\d+\s*[,.]\s*\d{2}/gi, " ")
    .replace(/[^A-Za-zÀ-ÿ0-9+./,'\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];

  const rawParts = cleaned.split(/\s{2,}|\s\/\s/).flatMap((part) => part.split(/\s{1,}(?=[A-ZÀ-Ý])/));
  const products = [];
  let buffer = [];

  for (const token of cleaned.split(/\s+/)) {
    const lower = foldText(token);
    if (!token || /^\d+$/.test(token) || SKIP_TOKENS.has(lower)) {
      if (buffer.length > 0) {
        products.push(buffer.join(" "));
        buffer = [];
      }
      continue;
    }
    if (token.length < 2) continue;
    buffer.push(token);
    if (buffer.length >= 5) {
      products.push(buffer.join(" "));
      buffer = [];
    }
  }
  if (buffer.length > 0) products.push(buffer.join(" "));
  return products.filter((name) => name.length > 2 && !/^de$/i.test(name));
}

function parseValidityFromLine(line, referenceYear = new Date().getFullYear()) {
  const sextaSabado = line.match(
    /sexta\s+e\s+s[aá]bado\s*[-–]?\s*(\d{1,2})\s+e\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
  );
  if (sextaSabado) {
    return {
      from: `${sextaSabado[4]}-${sextaSabado[3].padStart(2, "0")}-${sextaSabado[1].padStart(2, "0")}`,
      to: `${sextaSabado[4]}-${sextaSabado[3].padStart(2, "0")}-${sextaSabado[2].padStart(2, "0")}`,
    };
  }

  const slashPair = line.match(/(\d{1,2})\s+e\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (slashPair) {
    return {
      from: `${slashPair[4]}-${slashPair[3].padStart(2, "0")}-${slashPair[1].padStart(2, "0")}`,
      to: `${slashPair[4]}-${slashPair[3].padStart(2, "0")}-${slashPair[2].padStart(2, "0")}`,
    };
  }

  return parseDateRange(line, referenceYear);
}

export function parseCorsoValidityHints(ocrText) {
  const ranges = [];
  for (const match of ocrText.matchAll(VALIDITY_LINE)) {
    const parsed = parseValidityFromLine(match[0]);
    if (parsed) ranges.push(parsed);
  }
  const longForm = parseDateRange(ocrText.replace(/\s+/g, " "), new Date().getFullYear());
  if (longForm) ranges.push(longForm);
  const unique = [];
  const seen = new Set();
  for (const range of ranges) {
    const key = `${range.from}|${range.to}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(range);
    }
  }
  return unique;
}

function guessDetail(name) {
  if (/\b\d+\s*kg\b/i.test(name)) return "Kg";
  if (/\b\d+\s*g\b/i.test(name)) return name.match(/\b\d+\s*g\b/i)[0].replace(/\s+/g, "");
  if (/\b\d+\s*ml\b/i.test(name)) return name.match(/\b\d+\s*ml\b/i)[0].replace(/\s+/g, "");
  if (/\b\d+\s*l\b/i.test(name)) return name.match(/\b\d+\s*l\b/i)[0].replace(/\s+/g, "");
  if (/granel|kg\b/i.test(name)) return "Kg";
  if (/unidade|unid/i.test(name)) return "Unidade";
  if (/bandeja|pct|pacote/i.test(name)) return "Unidade";
  return "Unidade";
}

function guessCategory(name) {
  const n = foldText(name);
  if (/frango|bovin|suin|carne|ac|lingui|cupim|picanha|contrafil|sobrecoxa/i.test(n)) return "Carnes";
  if (/alface|cenoura|cebola|batata|beterraba|tomate|banana|uva|morango|abacaxi|maca|maçã|limao|laranja/i.test(n)) {
    return "Hortifruti";
  }
  if (/leite|queijo|requeij|iogurte|manteiga|mussarela/i.test(n)) return "Laticínios";
  if (/cerveja|refrigerante|agua|suco|vinho|energetico/i.test(n)) return "Bebidas";
  if (/sabao|detergente|amaciante|desinfetante|alvejante|papel higienico/i.test(n)) return "Limpeza";
  if (/arroz|feijao|feijão|macarrao|oleo|óleo|cafe|café|acucar|açúcar|biscoito|molho/i.test(n)) return "Mercearia";
  return "Geral";
}

function splitBrandName(fullName) {
  const tokens = fullName.trim().split(/\s+/);
  if (tokens.length < 2) return { name: fullName, brand: "" };
  const brand = tokens[tokens.length - 1];
  const name = tokens.slice(0, -1).join(" ");
  if (brand.length <= 2 || /^\d/.test(brand)) return { name: fullName, brand: "" };
  return { name, brand };
}

function pairGrid(names, oldPrices, prices) {
  const count = Math.min(names.length, prices.length);
  const offers = [];
  for (let i = 0; i < count; i += 1) {
    const price = prices[i];
    const oldPrice = oldPrices?.[i] ?? null;
    if (!Number.isFinite(price) || price <= 0) continue;
    const { name, brand } = splitBrandName(names[i]);
    if (!name || name.length < 2) continue;
    offers.push({
      name,
      brand,
      detail: guessDetail(name),
      cat: guessCategory(name),
      price,
      oldPrice: Number.isFinite(oldPrice) && oldPrice > price ? oldPrice : null,
    });
  }
  return offers;
}

export function parseCorsoFlyerText(ocrText) {
  if (!ocrText || typeof ocrText !== "string") return [];
  const validityRanges = parseCorsoValidityHints(ocrText);
  const defaultRange = validityRanges[0] ?? null;
  if (!defaultRange) return [];

  const lines = ocrText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const campaigns = [];
  let currentRange = defaultRange;
  let pendingOld = null;
  let pendingNames = null;

  function flushCampaign(range, offers) {
    if (!range || offers.length === 0) return;
    const existing = campaigns.find((c) => c.from === range.from && c.to === range.to);
    if (existing) {
      existing.offers.push(...offers);
    } else {
      campaigns.push({ from: range.from, to: range.to, offers: [...offers] });
    }
  }

  let sectionOffers = [];

  for (const line of lines) {
    const lower = foldText(line);
    if (lower.startsWith("ofertas validas") || lower.includes("promocao imbativel")) {
      const parsed = parseValidityFromLine(line);
      if (parsed) {
        if (sectionOffers.length > 0) {
          flushCampaign(currentRange, sectionOffers);
          sectionOffers = [];
        }
        currentRange = parsed;
      }
    }

    const prices = extractPricesFromLine(line);
    const nameCandidates = tokenizeProductLine(line);

    if (prices.length >= 3 && nameCandidates.length === 0) {
      if (!pendingOld) {
        pendingOld = prices;
      } else if (!pendingNames) {
        pendingNames = null;
        const paired = pairGrid(
          pendingOld.map((_, idx) => `Produto ${idx + 1}`),
          pendingOld,
          prices,
        );
        sectionOffers.push(...paired);
        pendingOld = null;
      } else {
        const paired = pairGrid(pendingNames, pendingOld, prices);
        sectionOffers.push(...paired);
        pendingOld = null;
        pendingNames = null;
      }
      continue;
    }

    if (prices.length >= 3 && nameCandidates.length >= 2) {
      pendingOld = prices;
      pendingNames = null;
      continue;
    }

    if (nameCandidates.length >= 2 && prices.length === 0) {
      pendingNames = nameCandidates;
      continue;
    }

    if (prices.length >= 1 && nameCandidates.length >= 1 && nameCandidates.length <= prices.length + 2) {
      const paired = pairGrid(nameCandidates, pendingOld, prices);
      sectionOffers.push(...paired);
      pendingOld = null;
      pendingNames = null;
    }
  }

  if (sectionOffers.length > 0) {
    flushCampaign(currentRange, sectionOffers);
  }

  for (const campaign of campaigns) {
    const seen = new Set();
    campaign.offers = campaign.offers.filter((item) => {
      const key = `${item.name}|${item.brand}|${item.price}|${item.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return campaigns.filter((c) => c.offers.length > 0);
}

export function latestValidityEnd(campaigns) {
  if (!Array.isArray(campaigns) || campaigns.length === 0) return null;
  return campaigns.reduce((max, c) => (c.to > max ? c.to : max), campaigns[0].to);
}

export function loadCorsoCampaignFile(raw) {
  return loadFlyerCampaignFile(raw);
}
