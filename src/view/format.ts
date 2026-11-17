import { normalizeSearchText } from "../../scripts/domain/offer-search.mjs";
import { isOfferActive } from "../../scripts/domain/offer-validity.mjs";
import { formatWeekdaySpotLabel } from "../../scripts/domain/spasso-weekday-validity.mjs";

const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const feedDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo",
});
const feedTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
});

/** Preço em reais, ex.: "R$ 4,18". */
export function money(value: number): string {
  return moneyFormatter.format(value);
}

/** Validade curta, ex.: "22 out". `value` é uma data ISO (AAAA-MM-DD). */
export function dateLabel(value: string): string {
  return dateFormatter.format(new Date(`${value}T12:00:00`)).replace(" de ", " ").replace(".", "");
}

/** Linha de atualização do catálogo, a partir de um timestamp ISO. */
export function formatFeedUpdate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Atualização das ofertas indisponível";
  const day = feedDateFormatter.format(date).replace(/\./g, "");
  const time = feedTimeFormatter.format(date);
  return `Catálogo atualizado em ${day}, ${time}`;
}

/** Texto de busca sem acentos, em minúsculas e com pontuação virando espaço. */
export function normalizeSearch(value: string): string {
  return normalizeSearchText(value);
}

/** Data de hoje no fuso de São Paulo, no formato AAAA-MM-DD. */
export function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${part.year}-${part.month}-${part.day}`;
}

/** Oferta válida na data informada (limites inclusivos; opcionalmente dias da semana do encarte). */
export function isActive(
  offer: { validFrom: string; validTo: string; validWeekdays?: number[] },
  today: string = todayInSaoPaulo(),
): boolean {
  return isOfferActive(offer, today);
}

/** Rótulo de validade: faixa de datas ou dias do encarte (Spasso). */
export function offerValidityLabel(offer: { validFrom: string; validTo: string; validWeekdays?: number[] }): string {
  const spot = formatWeekdaySpotLabel(offer.validWeekdays ?? []);
  if (spot) return spot;
  return `${dateLabel(offer.validFrom)}–${dateLabel(offer.validTo)}`;
}

/** Soma dias a uma data AAAA-MM-DD (meio-dia UTC evita borda de fuso). */
export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().slice(0, 10);
}

/**
 * Rótulo curto quando a validade está perto do fim (oferta ainda ativa hoje).
 * `null` quando não há destaque.
 */
export function expiryHighlightLabel(
  offer: { validFrom: string; validTo: string },
  today: string = todayInSaoPaulo(),
): string | null {
  if (!isActive(offer, today)) return null;
  if (offer.validTo === addCalendarDays(today, 1)) return "Expira amanhã";
  if (offer.validTo === today) return "Último dia";
  return null;
}
