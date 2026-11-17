// @ts-nocheck
/**
 * @param {string} today ISO date (America/Sao_Paulo)
 */
export function weekdayInSaoPaulo(today) {
  return new Date(`${today}T12:00:00Z`).getUTCDay();
}

/**
 * @param {{ validFrom: string, validTo: string, validWeekdays?: number[] }} offer
 * @param {string} today
 */
export function isOfferActive(offer, today) {
  if (today < offer.validFrom || today > offer.validTo) return false;
  const weekdays = offer.validWeekdays;
  if (Array.isArray(weekdays) && weekdays.length > 0) {
    return weekdays.includes(weekdayInSaoPaulo(today));
  }
  return true;
}