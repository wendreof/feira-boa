// @ts-nocheck
import { createHash } from "node:crypto";
import { loadFlyerCampaignFile } from "./flyer-campaign-cache.mjs";
import { decodeHtmlEntities } from "./html-entities.mjs";

const FLYER_HINT = /(?:^|[/_-])(?:flv|acougue|encarte|oferta|spasso-\d)/i;
const NOISE_HINT =
  /(?:logo|icon|favicon|cropped|placeholder|spinner|avatar|banner-site|google-play|apple-store|app-store|play-store|novidades|\bbg[-_])/i;

/** @param {string} url */
export function isSpassoFlyerImage(url) {
  if (!url || NOISE_HINT.test(url)) return false;
  if (FLYER_HINT.test(url)) return true;
  return /\/wp-content\/uploads\/20\d{2}\/\d{2}\/[^/]+\.(?:png|jpe?g|webp)$/i.test(url);
}

/** @param {string} url */
function uploadYearMonth(url) {
  const match = url.match(/\/uploads\/(\d{4})\/(\d{2})\//);
  if (!match) return 0;
  return Number(`${match[1]}${match[2]}`);
}

/** @param {string} url */
function flyerFamily(url) {
  const file = url.split("/").pop()?.toLowerCase() ?? "";
  if (file.includes("flv")) return "flv";
  if (file.includes("acougue") || file.includes("acogue")) return "acougue";
  return file.replace(/\.(?:png|jpe?g|webp)$/i, "");
}

/** @param {string[]} urls */
export function filterSpassoFlyerImages(urls) {
  const candidates = [];
  const seen = new Set();
  for (const url of urls) {
    if (!isSpassoFlyerImage(url) || seen.has(url)) continue;
    seen.add(url);
    candidates.push(url);
  }

  const newestByFamily = new Map();
  for (const url of candidates.sort((left, right) => uploadYearMonth(right) - uploadYearMonth(left))) {
    const family = flyerFamily(url);
    if (!newestByFamily.has(family)) newestByFamily.set(family, url);
  }

  return [...newestByFamily.values()];
}

/** @param {string} url */
export function labelSpassoFlyerImage(url) {
  const file = url.split("/").pop()?.replace(/\.png$/i, "") ?? "Encarte";
  if (/FLV/i.test(file)) return "Hortifruti";
  if (/ACOUGUE|ACOGUE/i.test(file)) return "Açougue";
  if (/SPASSO-\d/i.test(file)) return `Encarte ${file.match(/SPASSO-(\d+)/i)?.[1] ?? ""}`.trim();
  return file.replace(/-/g, " ");
}

const SPASSO_UPLOAD_IMAGE_RE =
  /src=["'](https?:\/\/spassosabores\.com\.br\/wp-content\/uploads\/[^"']+\.(?:png|jpe?g|webp)[^"']*)["']/gi;

export function discoverSpassoFlyersFromHtml(html) {
  if (!html || typeof html !== "string") return null;
  const decoded = decodeHtmlEntities(html);
  const urls = [...decoded.matchAll(SPASSO_UPLOAD_IMAGE_RE)].map((match) => match[1]);
  const imageUrls = filterSpassoFlyerImages(urls);
  if (imageUrls.length === 0) return null;
  return {
    imageUrls,
    hash: hashSpassoFlyerSet(imageUrls),
  };
}

/** @param {string[]} imageUrls */
export function hashSpassoFlyerSet(imageUrls) {
  const stable = [...imageUrls].sort().join("\n");
  return createHash("sha256").update(stable).digest("hex").slice(0, 16);
}

export function loadSpassoCampaignFile(raw) {
  return loadFlyerCampaignFile(raw);
}

/** @param {{ to?: string }[]} campaigns */
export function latestCampaignEndDate(campaigns) {
  let maxTo = null;
  for (const campaign of campaigns ?? []) {
    const to = campaign?.to;
    if (!to || (maxTo !== null && to <= maxTo)) continue;
    maxTo = to;
  }
  return maxTo;
}

/** @param {{ to?: string }[]} campaigns @param {string} [today] */
export function campaignCacheIsActive(campaigns, today = todayInSaoPaulo()) {
  const maxTo = latestCampaignEndDate(campaigns);
  return maxTo !== null && maxTo >= today;
}

function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function defaultSpassoValidityWindow(now = new Date()) {
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
  return { from: spDate, to: saturday.toISOString().slice(0, 10) };
}
