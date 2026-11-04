import { suggestSearches } from "../../scripts/domain/search-suggestions.mjs";
import { isActive, todayInSaoPaulo } from "../view/format";
import { appState } from "./state";
import { input } from "./dom";

const list = document.querySelector<HTMLUListElement>("#search-suggestions")!;
const clearButton = document.querySelector<HTMLButtonElement>("#search-clear")!;
const shell = document.querySelector<HTMLElement>(".search-shell")!;

let activeIndex = -1;
let suppressOpen = false;

function suggestionMeta(item: { kind: string; count: number }): string {
  if (item.kind === "store") return "loja";
  return item.count === 1 ? "1 oferta" : `${item.count} ofertas`;
}

function currentSuggestions() {
  const today = todayInSaoPaulo();
  const active = appState.offers.filter((offer) => isActive(offer, today));
  return suggestSearches(active, input.value, { limit: 6 });
}

function hideSuggestions(): void {
  list.hidden = true;
  list.replaceChildren();
  activeIndex = -1;
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
}

function paintSuggestions(): void {
  const items = currentSuggestions();
  clearButton.hidden = input.value.trim().length === 0;
  if (!items.length) {
    hideSuggestions();
    clearButton.hidden = input.value.trim().length === 0;
    return;
  }
  if (list.parentElement !== document.body) document.body.append(list);
  list.replaceChildren(...items.map((item, index) => {
    const option = document.createElement("li");
    option.id = `search-suggestion-${index}`;
    option.className = "search-suggestion";
    option.setAttribute("role", "option");
    option.dataset.query = item.label;
    const name = document.createElement("span");
    name.textContent = item.label;
    const meta = document.createElement("small");
    meta.textContent = suggestionMeta(item);
    option.append(name, meta);
    option.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applySuggestion(item.label);
    });
    return option;
  }));
  list.hidden = false;
  placeSuggestions();
  input.setAttribute("aria-expanded", "true");
  markActive();
}

function placeSuggestions(): void {
  const box = shell.getBoundingClientRect();
  list.style.position = "fixed";
  list.style.top = `${Math.round(box.bottom + 6)}px`;
  list.style.left = `${Math.round(box.left)}px`;
  list.style.width = `${Math.round(box.width)}px`;
  list.style.zIndex = "40";
}

function markActive(): void {
  const options = [...list.querySelectorAll<HTMLElement>(".search-suggestion")];
  options.forEach((option, index) => {
    option.classList.toggle("is-active", index === activeIndex);
  });
  if (activeIndex >= 0 && options[activeIndex]) {
    input.setAttribute("aria-activedescendant", options[activeIndex].id);
  } else {
    input.removeAttribute("aria-activedescendant");
  }
}

function applySuggestion(query: string): void {
  suppressOpen = true;
  input.value = query;
  hideSuggestions();
  clearButton.hidden = query.trim().length === 0;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

export function bindSearchSuggest(): void {
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", "search-suggestions");

  input.addEventListener("input", () => {
    if (suppressOpen) {
      suppressOpen = false;
      clearButton.hidden = input.value.trim().length === 0;
      hideSuggestions();
      return;
    }
    activeIndex = -1;
    paintSuggestions();
  });
  input.addEventListener("focus", paintSuggestions);
  input.addEventListener("blur", () => {
    window.setTimeout(hideSuggestions, 120);
  });
  input.addEventListener("keydown", (event) => {
    const options = [...list.querySelectorAll<HTMLElement>(".search-suggestion")];
    if (event.key === "Escape") {
      hideSuggestions();
      return;
    }
    if (!options.length || list.hidden) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = Math.min(options.length - 1, activeIndex + 1);
      markActive();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = Math.max(-1, activeIndex - 1);
      markActive();
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      applySuggestion(options[activeIndex].dataset.query ?? "");
    }
  });

  clearButton.addEventListener("click", () => {
    input.value = "";
    hideSuggestions();
    clearButton.hidden = true;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node) || shell.contains(event.target) || list.contains(event.target)) return;
    hideSuggestions();
  });
  window.addEventListener("resize", () => {
    if (!list.hidden) placeSuggestions();
  });
  window.addEventListener("scroll", () => {
    if (!list.hidden) placeSuggestions();
  }, true);
}

export function refreshSearchSuggest(): void {
  if (document.activeElement === input) paintSuggestions();
  else clearButton.hidden = input.value.trim().length === 0;
}
