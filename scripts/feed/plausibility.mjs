// Verificação automática de plausibilidade de um snapshot de loja.
// NÃO confere se os preços estão corretos: só detecta quebra do parser
// (contagem fora do padrão, preços absurdos, datas erradas, nenhuma oferta ativa).
import { validateSnapshot } from "../domain/validation.mjs";

export const COUNT_TOLERANCE = 0.3; // a contagem pode variar até ±30% entre folhetos
export const MAX_PLAUSIBLE_PRICE = 500; // R$ por item

/**
 * @param {object | null} previous snapshot anterior (committed)
 * @param {object} next snapshot recém-extraído
 * @param {Date} [now]
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkPlausibility(previous, next, now = new Date()) {
  const reasons = [];
  if (!validateSnapshot(next)) reasons.push("snapshot falhou na validação");
  const offers = Array.isArray(next?.offers) ? next.offers : [];
  if (offers.length === 0) reasons.push("nenhuma oferta extraída");

  const previousCount = Array.isArray(previous?.offers) ? previous.offers.length : 0;
  if (previousCount === 0) {
    reasons.push("sem snapshot anterior para comparar");
  } else if (offers.length > 0) {
    const ratio = offers.length / previousCount;
    if (Math.abs(ratio - 1) > COUNT_TOLERANCE) {
      reasons.push(`contagem mudou de ${previousCount} para ${offers.length} (fora de ±${Math.round(COUNT_TOLERANCE * 100)}%)`);
    }
  }

  const implausible = offers.filter((offer) => offer.price > MAX_PLAUSIBLE_PRICE);
  if (implausible.length > 0) reasons.push(`${implausible.length} oferta(s) acima de R$ ${MAX_PLAUSIBLE_PRICE}`);

  const today = now.toISOString().slice(0, 10);
  const activeToday = offers.some((offer) => offer.validFrom <= today && offer.validTo >= today);
  if (offers.length > 0 && !activeToday) reasons.push("nenhuma oferta válida hoje");

  const ids = new Set(offers.map((offer) => offer.id));
  if (ids.size !== offers.length) reasons.push("ids de oferta duplicados");

  return { ok: reasons.length === 0, reasons };
}
