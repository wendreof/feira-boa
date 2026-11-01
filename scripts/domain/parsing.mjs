import { foldText } from "../../src/shared/text.mjs";

const MONTHS = {
  janeiro: "01", jan: "01",
  fevereiro: "02", fev: "02",
  marco: "03", março: "03", mar: "03",
  abril: "04", abr: "04",
  maio: "05", mai: "05",
  junho: "06", jun: "06",
  julho: "07", jul: "07",
  agosto: "08", ago: "08",
  setembro: "09", set: "09",
  outubro: "10", out: "10",
  novembro: "11", nov: "11",
  dezembro: "12", dez: "12",
};

export function parseDateRange(text, referenceYear = new Date().getFullYear()) {
  if (!text || typeof text !== "string") return null;
  const clean = foldText(text).replace(/\s+/g, " ").trim();

  // Pattern 0: DD de [mes] a DD de [mes] de [ano]. Some flyers cross a
  // month boundary, so the start and end month need to be parsed separately.
  const m0 = clean.match(/(\d{1,2})\s+de\s+([a-z]+)\s*(?:a|ate|-)\s*(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (m0 && MONTHS[m0[2]] && MONTHS[m0[4]]) {
    return {
      from: `${m0[5]}-${MONTHS[m0[2]]}-${m0[1].padStart(2, "0")}`,
      to: `${m0[5]}-${MONTHS[m0[4]]}-${m0[3].padStart(2, "0")}`,
    };
  }

  // Pattern 1: de DD/MM ate DD/MM/YYYY or DD/MM a DD/MM/YYYY
  const m1 = clean.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(?:ate|a|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) {
    const fromYear = m1[3] || m1[6];
    const fromMonth = m1[2].padStart(2, "0");
    const fromDay = m1[1].padStart(2, "0");
    const toYear = m1[6];
    const toMonth = m1[5].padStart(2, "0");
    const toDay = m1[4].padStart(2, "0");
    return {
      from: `${fromYear}-${fromMonth}-${fromDay}`,
      to: `${toYear}-${toMonth}-${toDay}`,
    };
  }

  // Pattern 2: DD a DD de [mes] de [ano]
  const m2 = clean.match(/(\d{1,2})\s*(?:a|ate|-)\s*(\d{1,2})\s*(?:de\s+)?([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (m2 && MONTHS[m2[3]]) {
    const fromDay = m2[1].padStart(2, "0");
    const toDay = m2[2].padStart(2, "0");
    const month = MONTHS[m2[3]];
    const year = m2[4] || String(referenceYear);
    return {
      from: `${year}-${month}-${fromDay}`,
      to: `${year}-${month}-${toDay}`,
    };
  }

  // Pattern 3: DD a DD/MM/YYYY
  const m3 = clean.match(/(\d{1,2})\s*(?:a|ate|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m3) {
    const fromDay = m3[1].padStart(2, "0");
    const toDay = m3[2].padStart(2, "0");
    const month = m3[3].padStart(2, "0");
    const year = m3[4];
    return {
      from: `${year}-${month}-${fromDay}`,
      to: `${year}-${month}-${toDay}`,
    };
  }

  return null;
}

export function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "string") return null;
  const match = value.match(/R\$\s*(\d+)\s*[,.]\s*(\d{2})/i) || value.match(/(\d+)\s*[,.]\s*(\d{2})/);
  if (match) {
    return parseFloat(`${match[1]}.${match[2]}`);
  }
  return null;
}
