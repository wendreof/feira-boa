const headingCopy = document.querySelector<HTMLElement>(".results-heading-copy");
const badge = document.querySelector<HTMLElement>("#results-updated-badge");
const scopeBar = document.querySelector<HTMLElement>("#results-scope-bar");
const scopeFlash = document.querySelector<HTMLElement>("#results-scope-flash");

let hideTimer: number | undefined;

export type ResultsFeedbackReason = "store" | "search";

const BADGE_COPY: Record<ResultsFeedbackReason, string> = {
  store: "Lista da loja atualizada",
  search: "Resultados da busca atualizados",
};

export function markResultsUpdated(reason: ResultsFeedbackReason): void {
  headingCopy?.classList.add("results-heading-copy--fresh");
  if (badge) {
    badge.textContent = BADGE_COPY[reason];
    badge.hidden = false;
  }
  scopeBar?.classList.add("results-scope-bar--fresh");
  if (scopeFlash) scopeFlash.hidden = false;

  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    headingCopy?.classList.remove("results-heading-copy--fresh");
    if (badge) badge.hidden = true;
    scopeBar?.classList.remove("results-scope-bar--fresh");
    if (scopeFlash) scopeFlash.hidden = true;
  }, 2800);
}
