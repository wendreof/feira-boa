import { feedStatus } from "./dom";

const LOADING_ROW_CLASS = "feed-status-row";

export function showFeedLoading(): void {
  feedStatus.hidden = false;
  feedStatus.dataset.state = "loading";
  feedStatus.replaceChildren();
  const row = document.createElement("span");
  row.className = LOADING_ROW_CLASS;
  const spinner = document.createElement("span");
  spinner.className = "spinner feed-status-spinner";
  spinner.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = "Carregando ofertas…";
  row.append(spinner, label);
  feedStatus.append(row);
}

export function hideFeedLoading(): void {
  feedStatus.hidden = true;
  delete feedStatus.dataset.state;
  feedStatus.replaceChildren();
}