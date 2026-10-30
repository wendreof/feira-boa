// Regras puras da página de alertas de preço: validação, status e formatação.
// Sem acesso a banco, rede ou DOM, para que possam ser testadas com node --test.

export const MAX_ALERT_RULES = 20;
export const MAX_TARGET_PRICE = 10000;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function formatBrl(value) {
  return BRL.format(Number(value)).replace(/\u00a0/g, " ");
}

/** Aceita "12,50", "12.50" e "1.234,50". Retorna NaN quando não der para ler. */
export function parseTargetPrice(raw) {
  const text = String(raw ?? "").trim().replace(/\s/g, "");
  if (!text) return NaN;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return Number(normalized);
}

export function formatDateTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME.format(date);
}

/** @returns {{ ok: false, error: string }} */
function fail(error) {
  return { ok: false, error };
}

/**
 * Valida o formulário de alerta. Em edição (`editingId`) a própria regra é
 * ignorada na checagem de duplicidade e no limite.
 * @param {{
 *   productType: string | null | undefined,
 *   store: string | null | undefined,
 *   targetPrice: number | string | null | undefined,
 *   productTypes?: string[],
 *   stores?: string[],
 *   rules?: Array<{ id: string, product_type: string | null, store: string | null, target_price: number | string }>,
 *   editingId?: string | null,
 * }} input
 * @returns {{ ok: true, value: { product_type: string, store: string | null, target_price: number } } | { ok: false, error: string }}
 */
export function validateAlertRule({
  productType,
  store,
  targetPrice,
  productTypes = [],
  stores = [],
  rules = [],
  editingId = null,
}) {
  const type = String(productType ?? "").trim();
  if (!type) return fail("Escolha um tipo de produto.");
  if (productTypes.length > 0 && !productTypes.includes(type)) return fail("Escolha um tipo de produto da lista.");

  const storeName = String(store ?? "").trim();
  if (storeName && stores.length > 0 && !stores.includes(storeName)) return fail("Escolha uma loja da lista.");

  const price = typeof targetPrice === "number" ? targetPrice : parseTargetPrice(targetPrice);
  if (!Number.isFinite(price) || price <= 0) return fail("Informe um preço maior que zero.");
  if (price > MAX_TARGET_PRICE) return fail(`O preço máximo do alerta é ${formatBrl(MAX_TARGET_PRICE)}.`);
  if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) return fail("Use no máximo duas casas decimais no preço.");

  if (!editingId && rules.length >= MAX_ALERT_RULES) {
    return fail(`Você pode ter até ${MAX_ALERT_RULES} alertas. Exclua um para criar outro.`);
  }

  const store_ = storeName || null;
  const targetCents = Math.round(price * 100);
  const duplicate = rules.some((rule) => rule.id !== editingId
    && (rule.product_type ?? null) === type
    && (rule.store ?? null) === store_
    && Math.round(Number(rule.target_price) * 100) === targetCents);
  if (duplicate) return fail("Você já tem um alerta com este produto, loja e preço.");

  return { ok: true, value: { product_type: type, store: store_, target_price: targetCents / 100 } };
}

/** Texto de exibição de uma regra: produto, escopo de loja e preço máximo. */
export function describeRule(rule) {
  return {
    title: rule.product_type ?? rule.product ?? "Produto",
    scope: rule.store ?? "Qualquer loja",
    price: formatBrl(rule.target_price),
  };
}

/**
 * Aviso no topo da página, ou null quando não há nada a dizer.
 * @returns {{ tone: "ok" | "warning", message: string } | null}
 */
export function alertsBanner({ activeCount, deviceEnabled, permissionDenied = false }) {
  if (activeCount === 0) return null;
  if (!deviceEnabled) {
    return {
      tone: "warning",
      message: permissionDenied
        ? "O navegador bloqueou as notificações. Libere o site nas configurações para receber avisos."
        : "Seus alertas estão ativos, mas este dispositivo não recebe notificações. Ative abaixo.",
    };
  }
  return { tone: "ok", message: "Você receberá avisos neste dispositivo quando houver ofertas dentro dos seus alertas." };
}

/** Estado de um envio do histórico. */
export function notificationStatus(entry) {
  return entry.result === "sent"
    ? { key: "sent", label: "Enviada" }
    : { key: "failed", label: "Falhou" };
}

/** Explicação curta para envios que falharam, a partir do código gravado pelo job. */
export function failureHint(errorCode) {
  if (!errorCode) return "Motivo não identificado.";
  if (errorCode.startsWith("onesignal_http_4")) return "O serviço de notificações recusou o envio.";
  if (errorCode === "onesignal_api_error") return "Falha de conexão com o serviço de notificações.";
  return "Motivo não identificado.";
}
