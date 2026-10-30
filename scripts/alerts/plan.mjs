import { formatOfferPrice, ruleMatchesOffer } from "../offer-matcher.mjs";

/**
 * Relaciona regras de alerta ativas às ofertas que elas cobrem, por usuário.
 * Função pura: não acessa banco nem rede.
 *
 * @returns {Map<string, Map<string, object>>} userId -> (offerId -> oferta)
 */
export function matchOffersToUsers({ rules, offers }) {
  const matchedByUser = new Map();
  for (const rule of rules) {
    for (const offer of offers) {
      if (!ruleMatchesOffer(rule, offer)) continue;
      const matches = matchedByUser.get(rule.user_id) ?? new Map();
      matches.set(offer.id, offer);
      matchedByUser.set(rule.user_id, matches);
    }
  }
  return matchedByUser;
}

/**
 * Lista de envios pendentes: ignora pares usuário/oferta já enviados com sucesso.
 * @returns {Array<{ userId: string, offer: object }>}
 */
export function pendingNotifications(matchedByUser, alreadySent) {
  const pending = [];
  for (const [userId, offersById] of matchedByUser) {
    for (const offer of offersById.values()) {
      if (!alreadySent.has(`${userId}:${offer.id}`)) pending.push({ userId, offer });
    }
  }
  return pending;
}

/** "2026-11-01" -> "2026/11/01" (yyyy/MM/dd). Valores fora do formato são devolvidos sem mudança. */
export function formatIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  return match ? `${match[1]}/${match[2]}/${match[3]}` : String(value ?? "");
}

/** "2026-11-01" -> "01/11". Valores fora do formato são devolvidos sem mudança. */
export function formatShortDate(value) {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  return match ? `${match[2]}/${match[1]}` : String(value ?? "");
}

/** Título e corpo da notificação de uma oferta (guardados em notification_log). */
export function buildAlertMessage(offer) {
  return {
    title: `${offer.store}: oferta para você`,
    body: `${offer.name} por ${formatOfferPrice(offer.price)} · válida até ${formatIsoDate(offer.validTo)}.`,
  };
}

export const TELEGRAM_DISCLAIMER = "Preço do folheto. Confirme na loja.";

/**
 * Texto da mensagem enviada no Telegram: produto, loja/unidade, preço (com preço
 * anterior e desconto quando existem), validade curta, link e aviso curto.
 */
export function buildTelegramText(offer, siteUrl) {
  const icon = offer.icon ? `${offer.icon} ` : "";
  const storeLine = offer.branch ? `${offer.store} · ${offer.branch}` : offer.store;
  let priceLine = formatOfferPrice(offer.price);
  const previous = Number(offer.previousPrice);
  if (Number.isFinite(previous) && previous > offer.price) {
    const percent = Math.round((1 - offer.price / previous) * 100);
    const discount = percent >= 1 ? `, −${percent}%` : "";
    priceLine = `${priceLine} (antes ${formatOfferPrice(previous)}${discount})`;
  }
  const lines = [
    `${icon}${offer.name}`,
    storeLine,
    priceLine,
    `Válida até ${formatShortDate(offer.validTo)}`,
    offerUrl(siteUrl, offer),
  ];
  return `${lines.join("\n")}\n\n${TELEGRAM_DISCLAIMER}`;
}

/** Link da oferta no site, usado pela notificação. */
export function offerUrl(siteUrl, offer) {
  return new URL(`index.html?offer=${encodeURIComponent(offer.id)}`, siteUrl).href;
}
