import { readFile } from "node:fs/promises";
import { parseDateRange } from "./common.mjs";

const SPASSO_URL = "https://spassosabores.com.br/ofertas-sao-joao/";
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (official public flyer extraction)";

export async function extractSpasso(customUrl = null) {
  const pageUrl = customUrl || SPASSO_URL;
  const res = await fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Could not fetch Spasso page (${res.status})`);
  const html = await res.text();

  // Extract images
  const images = [...html.matchAll(/src=["'](https:\/\/spassosabores\.com\.br\/wp-content\/uploads\/[^"']+\.png)["']/gi)].map(m => m[1]);

  // Read existing snapshot if available to retain still-valid curated items
  let existingOffers = [];
  try {
    const existingText = await readFile(new URL("../../state/spasso.json", import.meta.url), "utf8");
    const existing = JSON.parse(existingText);
    if (Array.isArray(existing.offers)) existingOffers = existing.offers;
  } catch {
    // No previous snapshot yet
  }

  // Calculate current week cycle
  const now = new Date();
  const spDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const today = new Date(`${spDate}T12:00:00Z`);
  const dayOfWeek = today.getUTCDay();
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
  const saturday = new Date(today.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
  const saturdayStr = saturday.toISOString().slice(0, 10);

  const validity = { from: spDate, to: saturdayStr };

  return {
    storeId: "spasso",
    store: {
      name: "Spasso Sabores",
      branch: "Av. Dr. Durval Nicolau, 1572 · São João",
      logo: "https://spassosabores.com.br/wp-content/uploads/2021/01/logo-site-spasso-sabores-supermercados.png",
      source: "Folheto oficial · Loja São João",
      sourceUrl: pageUrl,
      from: validity.from,
      to: validity.to,
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: pageUrl,
    flyerImages: images.slice(0, 4),
    offers: existingOffers,
    status: existingOffers.length > 0 ? "ok" : "image_flyer_pending_transcription",
  };
}
