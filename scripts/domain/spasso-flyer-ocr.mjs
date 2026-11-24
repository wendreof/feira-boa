// @ts-nocheck
import { foldText } from "../../src/shared/text.mjs";
import { parseWeekdaysFromPortugueseText, spassoEncarteWindow } from "./spasso-weekday-validity.mjs";

const SECTION_MARKER = /^---\s+(.+?)\s+---\s*$/;
const INLINE_OFFER = /^(.+?)\s+R\$\s*(\d+)\s*[,.]\s*(\d{2})\s*$/i;
function defaultCategoryForSection(label) {
  const folded = foldText(label);
  if (folded.includes("hortifruti") || folded.includes("flv")) return "Hortifruti";
  if (folded.includes("acougue") || folded.includes("acogue") || folded.includes("carne")) return "Carnes";
  if (folded.includes("frio") || folded.includes("latic")) return "Frios";
  if (folded.includes("mercearia")) return "Mercearia";
  return "Geral";
}

function guessDetail(name) {
  if (/\b\d+\s*kg\b/i.test(name)) return "Kg";
  if (/\b100\s*g\b/i.test(name)) return "Cada 100g";
  if (/granel|kg\b/i.test(name)) return "Kg";
  return "Unidade";
}

function parseInlineOffer(line, defaultCat) {
  const match = line.match(INLINE_OFFER);
  if (!match) return null;
  const name = match[1].replace(/\s+/g, " ").trim();
  const price = parseFloat(`${match[2]}.${match[3]}`);
  if (!name || name.length < 2 || !Number.isFinite(price) || price <= 0) return null;
  return {
    name,
    brand: "",
    detail: guessDetail(name),
    cat: defaultCat,
    price,
    oldPrice: null,
  };
}

function parseLoosePriceLine(line) {
  const prices = [];
  let match;
  const re = /R\$\s*(\d+)\s*[,.]\s*(\d{2})/gi;
  while ((match = re.exec(line)) !== null) {
    prices.push(parseFloat(`${match[1]}.${match[2]}`));
  }
  const name = line.replace(/R\$\s*(\d+)\s*[,.]\s*(\d{2})/gi, " ").replace(/\s+/g, " ").trim();
  if (prices.length !== 1 || name.length < 3) return null;
  return {
    name,
    brand: "",
    detail: guessDetail(name),
    cat: "Geral",
    price: prices[0],
    oldPrice: null,
  };
}

function isSectionBanner(line) {
  const folded = foldText(line);
  if (parseWeekdaysFromPortugueseText(folded)?.length && /(hortifruti|acougue|acogue|frios|encarte)/i.test(line)) {
    return true;
  }
  return false;
}

function weekdayLabelsFromLine(line) {
  const days = parseWeekdaysFromPortugueseText(line);
  if (!days?.length) return null;
  const names = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return days.map((dow) => names[dow]);
}

/**
 * @param {string} ocrText
 * @returns {{ from: string, to: string, weekdays?: string[], label?: string, offers: object[] }[]}
 */
export function parseSpassoFlyerOcrText(ocrText) {
  if (!ocrText || typeof ocrText !== "string") return [];

  const window = spassoEncarteWindow();
  let sectionCat = "Geral";
  let sectionLabel = null;
  let sectionWeekdays = null;
  let offers = [];

  const campaigns = [];

  function flush() {
    if (offers.length === 0) return;
    campaigns.push({
      from: window.from,
      to: window.to,
      weekdays: sectionWeekdays ?? undefined,
      label: sectionLabel ?? undefined,
      offers: [...offers],
    });
    offers = [];
  }

  for (const rawLine of ocrText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const section = line.match(SECTION_MARKER);
    if (section) {
      flush();
      sectionLabel = section[1];
      sectionCat = defaultCategoryForSection(section[1]);
      continue;
    }

    if (isSectionBanner(line)) {
      flush();
      sectionLabel = line;
      sectionWeekdays = weekdayLabelsFromLine(line);
      if (/hortifruti|flv/i.test(line)) sectionCat = "Hortifruti";
      else if (/acougue|acogue|carne/i.test(line)) sectionCat = "Carnes";
      continue;
    }

    const inline = parseInlineOffer(line, sectionCat);
    if (inline) {
      offers.push(inline);
      continue;
    }

    const loose = parseLoosePriceLine(line);
    if (loose) {
      loose.cat = sectionCat;
      offers.push(loose);
    }
  }

  flush();

  for (const campaign of campaigns) {
    const seen = new Set();
    campaign.offers = campaign.offers.filter((item) => {
      const key = `${item.name}|${item.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return campaigns.filter((c) => c.offers.length > 0);
}

function countOffers(campaigns) {
  if (!Array.isArray(campaigns)) return 0;
  return campaigns.reduce((sum, campaign) => sum + (campaign.offers?.length ?? 0), 0);
}

/**
 * @param {{ ocr: object[], gemini: object[] | null, minGemini: number }} params
 */
export function pickSpassoExtractionWinner({ ocr, gemini, minGemini }) {
  const ocrCount = countOffers(ocr);
  const geminiCount = countOffers(gemini);

  if (gemini && geminiCount >= minGemini && geminiCount > ocrCount) {
    return { campaigns: gemini, extractionMethod: "gemini" };
  }
  if (ocrCount > 0) {
    return { campaigns: ocr, extractionMethod: "ocr" };
  }
  if (gemini && geminiCount > 0) {
    return { campaigns: gemini, extractionMethod: "gemini" };
  }
  return { campaigns: [], extractionMethod: "none" };
}