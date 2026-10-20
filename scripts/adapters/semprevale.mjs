import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
import { assignIcon, classifyProduct, parseDateRange, slug, validateOffer } from "./common.mjs";

const DURVAL_NICOLAU_ENDPOINT = "https://www.semprevale.com.br/get_unidades_ofertas.php";
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

export async function extractSempreVale(customUrl = null) {
  let flyerUrl = customUrl;
  let validity = null;

  if (!flyerUrl) {
    const formRes = await fetch(DURVAL_NICOLAU_ENDPOINT, {
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
    flyerUrl = new URL(pdfMatch[1], "https://www.semprevale.com.br/").href;

    const dateMatch = html.match(/de\s*(\d{1,2}\/\d{1,2})\s*at[eé]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    validity = parseDateRange(dateMatch ? dateMatch[0] : "", 2026);
  }

  const res = await fetch(flyerUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not fetch Sempre Vale flyer PDF (${res.status})`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const text = (await parser.getText()).text;

  if (!validity) {
    const fallbackMatch = text.match(/(?:DE\s+)?(\d{1,2})\s*(?:A|AT[EÉ]|-)\s*(\d{1,2}(?:\/\d{1,2}(?:\/\d{4})?|\s*DE\s*[A-Z]+))/i);
    validity = parseDateRange(fallbackMatch ? fallbackMatch[0] : "", 2026) || { from: "2026-10-19", to: "2026-10-21" };
  }

  const normalized = text.replace(/\t/g, "\n");
  const priceRegex = /R\$\s*(\d+)\s*[,.]\s*(\d{2})/g;
  const matches = [];
  let m;
  while ((m = priceRegex.exec(normalized)) !== null) {
    matches.push({
      full: m[0],
      price: parseFloat(`${m[1]}.${m[2]}`),
      index: m.index,
      length: m[0].length,
    });
  }

  let segments = [];
  let lastIndex = 0;
  for (let i = 0; i < matches.length; i++) {
    const textBefore = normalized.substring(lastIndex, matches[i].index).trim();
    segments.push({
      text: textBefore,
      price: matches[i].price,
      index: matches[i].index,
    });
    lastIndex = matches[i].index + matches[i].length;
  }

  let offers = [];
  let currentText = "";
  let pendingOldPrice = null;
  let currentNote = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const rawText = seg.text;

    const limitMatch = rawText.match(/Limite\s+(?:por\s+)?cliente[^\n\r]*/i);
    let cleanedText = rawText;
    if (limitMatch) {
      currentNote = `${currentNote ? `${currentNote} · ` : ""}${limitMatch[0].trim()}`.trim();
      cleanedText = cleanedText.replace(limitMatch[0], "").trim();
    }

    const bundleMatch = cleanedText.match(/Pague\s+\d+\s+Leve\s+\d+[^\n\r]*/i);
    if (bundleMatch) {
      currentNote = `${currentNote ? `${currentNote} · ` : ""}${bundleMatch[0].trim()}`.trim();
      cleanedText = cleanedText.replace(bundleMatch[0], "").trim();
    }

    if (cleanedText.length > 0) {
      currentText = `${currentText ? `${currentText} ` : ""}${cleanedText}`.trim();
    }

    const nextSeg = segments[i + 1];
    const nextTextClean = nextSeg ? nextSeg.text.replace(/Limite[^\n]*|Pague[^\n]*/gi, "").trim() : "hasText";
    const nextTextIsEmpty = nextTextClean.length === 0;

    if (nextSeg && nextTextIsEmpty && nextSeg.price < seg.price) {
      pendingOldPrice = seg.price;
      continue;
    }

    const productPrice = seg.price;
    const oldPrice = pendingOldPrice;
    pendingOldPrice = null;

    let desc = currentText.replace(/\s+/g, " ")
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
      .replace(/DE\s+\d+\s+A\s+\d+[^.]*OUT\.?/gi, "")
      .replace(/DE\s+\d+\s+A\s+\d+\/\d+\/\d+/gi, "")
      .trim();

    currentText = "";
    const note = currentNote;
    currentNote = "";

    if (/^Nesta promo[çc][aã]o\s+a\s+unidade/i.test(desc) || desc.length < 3) {
      continue;
    }

    const unitMatch = desc.match(/(?:(?:\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|unids?\.?))|granel\s+kg|pct\s+kg|un\.|par|bdj\s+\d+g|l4p3|lv\s*\d+\s*pg\s*\d+|cada\s+100g)$/i);
    const detail = unitMatch ? unitMatch[0].trim() : "Unidade";
    const nameOnly = desc.replace(new RegExp(`\\s*${detail.replace(".", "\\.")}\\s*$`, "i"), "").trim();

    if (nameOnly.length < 2) continue;

    const taxonomy = classifyProduct(nameOnly, "", "Geral");
    const icon = assignIcon(nameOnly, taxonomy.productType, taxonomy.department);

    const offer = {
      id: `sempre-${slug(`${nameOnly}-${detail}-${validity.from}`)}`,
      store: "Sempre Vale",
      storeLogo: "https://www.semprevale.com.br/images/logo-pequeno.png",
      branch: "Durval Nicolau",
      name: nameOnly,
      brand: "",
      detail: detail,
      category: taxonomy.department,
      department: taxonomy.department,
      productType: taxonomy.productType,
      productTypes: taxonomy.productTypes,
      price: productPrice,
      previousPrice: oldPrice,
      icon,
      tone: "#edf4e9",
      note,
      validFrom: validity.from,
      validTo: validity.to,
      source: "Folheto oficial · Durval Nicolau",
      sourceUrl: flyerUrl,
    };

    if (validateOffer(offer)) {
      offers.push(offer);
    }
  }

  return {
    storeId: "sempre",
    store: {
      name: "Sempre Vale",
      branch: "Durval Nicolau",
      logo: "https://www.semprevale.com.br/images/logo-pequeno.png",
      source: "Folheto oficial · Durval Nicolau",
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
