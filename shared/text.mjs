/**
 * Normalização de texto compartilhada por scripts (Node) e páginas (browser).
 * Não depende de ambiente: só usa APIs padrão do JavaScript.
 */

/** Remove acentos e diacríticos, mantendo o restante do texto. */
export function foldAccents(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Sem acentos e em minúsculas. Use para comparações insensíveis a acento e caixa. */
export function foldText(value) {
  return foldAccents(value).toLowerCase();
}

/** Sem acentos, minúsculas, e qualquer sequência não alfanumérica vira um espaço. */
export function comparableText(value) {
  return foldText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

/** Identificador de URL/chave: sem acentos, minúsculas, separadores viram "-". */
export function slugText(value) {
  return foldText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
