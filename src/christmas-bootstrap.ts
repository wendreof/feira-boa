import {
  parseChristmasSeasonQuery,
  resolveChristmasSeasonEnabled,
  todayIsoInTimeZone,
} from "../scripts/domain/christmas-season.mjs";

const STORAGE_PREVIEW_KEY = "feira-boa:christmas-preview:v1";

function readStorageOverride(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREVIEW_KEY);
    if (raw === "1" || raw === "true" || raw === "on") return true;
    if (raw === "0" || raw === "false" || raw === "off") return false;
  } catch {
    // Private mode — fall through to calendar gating.
  }
  return null;
}

(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const enabled = resolveChristmasSeasonEnabled({
      today: todayIsoInTimeZone(),
      queryOverride: parseChristmasSeasonQuery(params),
      storageOverride: readStorageOverride(),
    });
    if (enabled) document.documentElement.dataset.christmas = "on";
    else delete document.documentElement.dataset.christmas;
  } catch {
    delete document.documentElement.dataset.christmas;
  }
})();
