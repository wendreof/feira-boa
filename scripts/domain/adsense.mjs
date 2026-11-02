// Decide se o script de anúncios automáticos do AdSense entra na página.
// Sem rede e sem DOM. O _headers lista os hosts do script e dos iframes;
// o Google não garante essa lista, porque o caminho oficial é um nonce por resposta.

export const ADSENSE_CLIENT_ID = "ca-pub-7989265241424368";
export const ADSENSE_CSP_READY = true;

const AD_PAGES = new Set(["index.html", "lojas.html"]);
const CLIENT_ID_PATTERN = /^ca-pub-\d{16}$/;
const ADSENSE_CERTIFICATION_AUTHORITY = "f08c47fec0942fa0";

export function normalizeAdPage(page) {
  const path = String(page ?? "").split(/[?#]/, 1)[0];
  const name = path.split("/").filter(Boolean).pop() ?? "";
  return name || "index.html";
}

export function adsenseDecision({
  clientId = ADSENSE_CLIENT_ID,
  cspReady = ADSENSE_CSP_READY,
  plan = "free",
  page = "index.html",
} = {}) {
  const id = String(clientId ?? "").trim();
  if (!CLIENT_ID_PATTERN.test(id)) return { enabled: false, reason: "missing-client" };
  if (!cspReady) return { enabled: false, reason: "csp" };
  if (plan === "plus") return { enabled: false, reason: "plus" };
  const normalizedPage = normalizeAdPage(page);
  if (!AD_PAGES.has(normalizedPage)) return { enabled: false, reason: "page" };
  return { enabled: true, clientId: id, page: normalizedPage };
}

export function adsTxtLine(clientId) {
  const id = String(clientId ?? "").trim();
  if (!CLIENT_ID_PATTERN.test(id)) return "";
  return `google.com, ${id.slice("ca-".length)}, DIRECT, ${ADSENSE_CERTIFICATION_AUTHORITY}`;
}

export function adsenseScriptSrc(clientId = ADSENSE_CLIENT_ID) {
  const id = String(clientId ?? "").trim();
  if (!CLIENT_ID_PATTERN.test(id)) return "";
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${id}`;
}
