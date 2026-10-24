import { comparableText } from "./text.mjs";

/**
 * A marca vive dentro do nome do produto: não existe campo separado de marca
 * na oferta publicada. Quando o nome já traz a marca (ex.: "Maionese
 * Hellmann's 500g"), ele fica como está; senão a marca entra no fim.
 *
 * @param {string} name
 * @param {string} [brand]
 * @returns {string}
 */
export function mergeBrandIntoName(name, brand) {
  const cleanName = String(name ?? "").replace(/\s+/g, " ").trim();
  const cleanBrand = String(brand ?? "").replace(/\s+/g, " ").trim();
  if (!cleanBrand) return cleanName;
  const normalizedName = ` ${comparableText(cleanName)} `;
  if (normalizedName.includes(` ${comparableText(cleanBrand)} `)) return cleanName;
  return `${cleanName} ${cleanBrand}`.trim();
}
