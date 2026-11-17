import {
  FAVICON_CHRISTMAS,
  FAVICON_DEFAULT,
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
    // Private mode — default theme on.
  }
  return null;
}

function faviconAssetName(enabled: boolean): string {
  return enabled ? FAVICON_CHRISTMAS : FAVICON_DEFAULT;
}

function endsWithFaviconName(src: string, name: string): boolean {
  return src.endsWith(`/${name}`) || src.endsWith(name) || src.includes(name);
}

function applySeasonalFavicon(enabled: boolean) {
  const target = faviconAssetName(enabled);
  const alternate = enabled ? FAVICON_DEFAULT : FAVICON_CHRISTMAS;

  const shouldSwap = (value: string) =>
    endsWithFaviconName(value, alternate) || value === FAVICON_DEFAULT || value === FAVICON_CHRISTMAS;

  document.querySelectorAll<HTMLImageElement>("img.brand-mark, .sidebar-brand-mark img").forEach((img) => {
    const current = img.getAttribute("src") ?? "";
    if (!current.endsWith(".svg")) return;
    if (endsWithFaviconName(current, target)) return;
    if (shouldSwap(current)) img.src = target;
  });

  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (!href.endsWith(".svg")) return;
    if (endsWithFaviconName(href, target)) return;
    if (shouldSwap(href)) link.href = target;
  });
}

function scheduleSeasonalFavicon(enabled: boolean) {
  applySeasonalFavicon(enabled);
  const refreshMarks = () => applySeasonalFavicon(enabled);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshMarks, { once: true });
  }
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
    scheduleSeasonalFavicon(enabled);
  } catch {
    delete document.documentElement.dataset.christmas;
    scheduleSeasonalFavicon(false);
  }
})();