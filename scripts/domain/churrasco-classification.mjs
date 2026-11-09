import { foldText } from "../../src/shared/text.mjs";

/** Cortes de ave do dia a dia ficam no açougue, não na vitrine de churrasco. */
const POULTRY_DAILY_CUT =
  /\b(frango|galinha|peru|coxa|sobrecoxa|sassami|asa de|file de frango|filé de frango|peito de frango|tulipa|moela|cora(c|ç)ao de frango)\b/;

const CHURRASCO_MEAT =
  /\bpicanha\b|\bfraldinha\b|\bmaminha\b|\bcostela\b|\bcontrafile\b|\bentrecote\b|\bancho\b|\blinguica\b|\bpao de alho\b|\bqueijo coalho\b|\bcarvao (para|de churrasco)\b|\bespeto\b|\bgrelha\b|\bacendedor\b|\bbisteca\b|\bpanceta\b|\balcatra\b|\bfile mignon\b|\bfilé mignon\b|\bcarne moida\b/;

/**
 * @param {string} text
 */
export function isPoultryCounterOffer(text) {
  return POULTRY_DAILY_CUT.test(foldText(text));
}

/**
 * @param {string} text
 */
const NOT_BBQ_CONTEXT = /\b(macarrao|noodles|instantaneo|sopa|molho|tempero|salgadinho|snack|cup)\b/;

export function isBarbecueProductName(text) {
  const normalized = foldText(text);
  if (isPoultryCounterOffer(normalized)) return false;
  if (NOT_BBQ_CONTEXT.test(normalized)) return false;
  return CHURRASCO_MEAT.test(normalized);
}
