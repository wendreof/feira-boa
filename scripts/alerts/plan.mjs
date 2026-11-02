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

function addCalendarDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().slice(0, 10);
}

/** Destaque de validade (AAAA-MM-DD `today`, fuso São Paulo no job). */
export function expiryHighlightForAlerts(offer, today) {
  if (today < offer.validFrom || today > offer.validTo) return null;
  if (offer.validTo === addCalendarDays(today, 1)) return "Expira amanhã";
  if (offer.validTo === today) return "Último dia";
  return null;
}

/** Título e corpo da notificação de uma oferta (guardados em notification_log). */
export function buildAlertMessage(offer) {
  return {
    title: `${offer.store}: oferta para você`,
    body: `${offer.name} por ${formatOfferPrice(offer.price)} · válida até ${formatIsoDate(offer.validTo)}.`,
  };
}

export const TELEGRAM_DISCLAIMER = "Preço do folheto. Confirme na loja.";
export const TELEGRAM_MAX_OFFERS_PER_USER = 5;

/**
 * Texto da mensagem enviada no Telegram: produto, loja, preço, validade e urgência.
 * O link fica no botão inline (`buildTelegramReplyMarkup`).
 */
export function buildTelegramText(offer, siteUrl, today) {
  const icon = offer.icon ? `${offer.icon} ` : "";
  let priceLine = formatOfferPrice(offer.price);
  const previous = Number(offer.previousPrice);
  if (Number.isFinite(previous) && previous > offer.price) {
    const percent = Math.round((1 - offer.price / previous) * 100);
    const discount = percent >= 1 ? `, −${percent}%` : "";
    priceLine = `${priceLine} (antes ${formatOfferPrice(previous)}${discount})`;
  }
  const lines = [
    `${icon}${offer.name}`,
    offer.store,
    priceLine,
    `Válida até ${formatShortDate(offer.validTo)}`,
  ];
  if (today) {
    const expiry = expiryHighlightForAlerts(offer, today);
    if (expiry) lines.push(expiry);
  }
  void siteUrl;
  return `${lines.join("\n")}\n\n${TELEGRAM_DISCLAIMER}`;
}

export function buildTelegramReplyMarkup(offer, siteUrl) {
  return {
    inline_keyboard: [[{ text: "Ver oferta no site", url: offerUrl(siteUrl, offer) }]],
  };
}

/**
 * Limita mensagens por usuário; o restante vira um resumo único (não deduplicado no log).
 */
export function partitionTelegramDelivery(pending, maxPerUser = TELEGRAM_MAX_OFFERS_PER_USER) {
  const byUser = new Map();
  for (const item of pending) {
    const list = byUser.get(item.userId) ?? [];
    list.push(item);
    byUser.set(item.userId, list);
  }
  const immediate = [];
  const digests = [];
  for (const [userId, items] of byUser) {
    immediate.push(...items.slice(0, maxPerUser));
    if (items.length > maxPerUser) digests.push({ userId, offers: items.slice(maxPerUser) });
  }
  return { immediate, digests };
}

export function buildTelegramDigestText(offers, siteUrl) {
  const alertsUrl = new URL("alertas.html", siteUrl).href;
  const preview = offers.slice(0, 8).map((offer) => {
    const icon = offer.icon ? `${offer.icon} ` : "";
    return `• ${icon}${offer.name} · ${formatOfferPrice(offer.price)} · ${offer.store}`;
  });
  const tail = offers.length > 8 ? `\n… e mais ${offers.length - 8}.` : "";
  return `Mais ${offers.length} oferta(s) nos seus alertas:\n${preview.join("\n")}${tail}\n\nVer regras: ${alertsUrl}`;
}

/** Link da oferta no site, usado pela notificação. */
export function offerUrl(siteUrl, offer) {
  return new URL(`index.html?offer=${encodeURIComponent(offer.id)}`, siteUrl).href;
}
