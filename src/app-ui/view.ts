import { appState, type ViewMode } from "./state";
import { grid, viewToggle } from "./dom";
import { resolveDefaultViewMode } from "../../view-mode.js";

export const mobileViewMedia = window.matchMedia("(max-width: 760px)");

export function readViewMode(): ViewMode {
  try {
    return resolveDefaultViewMode(localStorage.getItem("feira-boa:view-mode:v1"), mobileViewMedia.matches);
  } catch {
    return resolveDefaultViewMode(null, mobileViewMedia.matches);
  }
}

export function updateViewMode(): void {
  grid.classList.toggle("list-view", appState.viewMode === "list");
  viewToggle.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((button) => {
    const isSelected = button.dataset.viewMode === appState.viewMode;
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = mobileViewMedia.matches && button.dataset.viewMode !== "list";
  });
}

export function persistViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem("feira-boa:view-mode:v1", mode);
  } catch {
    // Keep the selected view for this page even when storage is unavailable.
  }
}
