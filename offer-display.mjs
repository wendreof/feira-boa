import { comparableText } from "./shared/text.mjs";

/**
 * A marca só aparece em destaque quando o nome do produto ainda não a contém.
 * Ex.: "Maionese Hellmann's 500g" já traz "Hellmann's", então a marca não se
 * repete no card.
 */
export function shouldShowBrand(name, brand) {
  const normalizedBrand = comparableText(brand);
  if (!normalizedBrand) return false;
  const normalizedName = ` ${comparableText(name)} `;
  return !normalizedName.includes(` ${normalizedBrand} `);
}
