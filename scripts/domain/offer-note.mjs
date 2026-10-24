function formatLimitNote(note) {
  const limit = note.match(/^limite (?:por cliente\s*(?:de\s+)?|de\s+)(\d+(?:[.,]\d+)?)\s*(kg|g|un\.?|unid\.?|unidade?s?)(?:\s+por cliente)?$/i);
  if (!limit) return null;
  const quantity = limit[1].replace(".", ",");
  const unit = limit[2].toLowerCase().replace(".", "");
  const unitLabel = unit === "kg" || unit === "g"
    ? unit
    : Number(quantity.replace(",", ".")) === 1 ? "unidade" : "unidades";
  return `Limite de ${quantity} ${unitLabel} por cliente`;
}

export function normalizeOfferNote(value) {
  const note = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!note) return "";

  const limit = formatLimitNote(note);
  if (limit) return limit;

  const promotion = note.match(/^nesta oferta a unid\. sai por (.+)$/i);
  if (promotion) {
    const details = promotion[1]
      .replace(/\bPOR\b/gi, "por")
      .replace(/\bPAGUE\b/gi, "pague")
      .replace(/\bLEVE\b/gi, "leve");
    return `Nesta oferta, a unidade sai por ${details}`;
  }

  return note.split(" · ").map((part) => {
    if (/^preço club plus$/i.test(part)) return "Preço Club Plus";
    if (/^oferta do açougue/i.test(part)) return `Oferta do açougue${part.slice("Oferta do açougue".length)}`;
    const partLimit = formatLimitNote(part);
    if (partLimit) return partLimit;
    // Extrato corrompido pelo PDF (ex.: "Limite por cliente— —UN"): sem
    // quantidade não há aviso útil, então some em vez de publicar lixo.
    if (/^limite\b/i.test(part)) return "";
    return part;
  }).filter(Boolean).join(" · ");
}


function formatBundleAmount(qty, unit) {
  const normalized = String(unit ?? "").toLowerCase().replace(/\.$/, "");
  const isCount = !normalized || normalized === "un" || normalized === "unid" || normalized === "unidade" || normalized === "unidades";
  return isCount ? String(qty) : `${qty}${normalized}`;
}

const BUNDLE_AMOUNT = /^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|unid(?:ades?)?\.?|un)?/i;
const BUNDLE_UNIT = "(kg|g|ml|l|unid(?:ades?)?\\.?|un)?";

export function extractBundleCodes(text, payHint = "") {
  const notes = [];
  const pushNote = (take, pay) => {
    if (take && pay) notes.push(`Leve ${take} e pague ${pay}`);
    return " ";
  };
  const cleaned = text
    .replace(/\blv\s*(\d+)\s*pg\s*(\d+)?\b/gi, (full, take, pay) => pushNote(take, pay))
    .replace(/\bl(\d+)p(\d+)\b/gi, (full, take, pay) => pushNote(take, pay))
    .replace(new RegExp(`\\bleve\\s*(\\d+(?:[.,]\\d+)?)\\s*${BUNDLE_UNIT}\\s*,?\\s*(?:e\\s+|de\\s+)?pague\\s*(\\d+(?:[.,]\\d+)?)\\s*${BUNDLE_UNIT}`, "gi"),
      (full, takeQty, takeUnit, payQty, payUnit) => pushNote(formatBundleAmount(takeQty, takeUnit), formatBundleAmount(payQty, payUnit)))
    .replace(new RegExp(`\\s*\\bleve\\s*(\\d+(?:[.,]\\d+)?)\\s*${BUNDLE_UNIT}\\s*,?\\s*pague(?!\\s*\\d)`, "gi"),
      (full, takeQty, takeUnit) => {
        const pay = String(payHint).match(BUNDLE_AMOUNT);
        if (pay) pushNote(formatBundleAmount(takeQty, takeUnit), formatBundleAmount(pay[1], pay[2]));
        return " ";
      })
    .replace(/\s*\b(compre\s*\d+\s*unids?\b\.?\s*e\s*ganhe\b.*?\b\d+(?:[.,]\d+)?\s*l\b)\s*\d*/gi, (full, promo) => {
      notes.push(promo.replace(/\s+/g, " ").trim());
      return " ";
    })
    .replace(/\s+/g, " ").trim();
  return { text: cleaned, notes };
}
