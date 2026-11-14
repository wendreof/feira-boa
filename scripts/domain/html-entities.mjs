import { decode as decodeHtmlReferences } from "he";

/**
 * Decode HTML character references so regex scrapers see literal URLs and text.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function decodeHtmlEntities(value) {
  if (value == null || typeof value !== "string") return "";
  if (!value.includes("&")) return value;
  return decodeHtmlReferences(value, { strict: false, isAttributeValue: false });
}