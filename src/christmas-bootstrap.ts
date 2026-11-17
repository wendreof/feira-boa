import {
  FAVICON_CHRISTMAS,
  FAVICON_DEFAULT,
  MANIFEST_CHRISTMAS,
  MANIFEST_DEFAULT,
  PWA_ICON_192_CHRISTMAS,
  PWA_ICON_192_DEFAULT,
  parseChristmasSeasonQuery,
  resolveChristmasSeasonEnabled,
  siteAppleTouchIconHref,
  siteFaviconPath,
  siteManifestHref,
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

function endsWithFaviconName(src: string, name: string): boolean {
  return src.endsWith(`/${name}`) || src.endsWith(name) || src.includes(name);
}

function applySeasonalFavicon(enabled: boolean) {
  const target = siteFaviconPath({ christmas: enabled });
  const alternate = siteFaviconPath({ christmas: !enabled });

  const shouldSwap = (value: string) =>
    endsWithFaviconName(value, alternate)
    || value === FAVICON_DEFAULT
    || value === FAVICON_CHRISTMAS
    || value === `/${FAVICON_DEFAULT}`
    || value === `/${FAVICON_CHRISTMAS}`;

  document.querySelectorAll<HTMLImageElement>(".topbar .brand img.brand-mark, .sidebar-brand-mark img").forEach((img) => {
    const current = img.getAttribute("src") ?? "";
    if (!current.endsWith(".svg")) return;
    if (endsWithFaviconName(current, enabled ? FAVICON_CHRISTMAS : FAVICON_DEFAULT)) return;
    if (shouldSwap(current)) img.src = target;
  });

  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (!href.endsWith(".svg")) return;
    if (endsWithFaviconName(href, enabled ? FAVICON_CHRISTMAS : FAVICON_DEFAULT)) return;
    if (shouldSwap(href)) link.href = target;
  });
}

function applySeasonalPwaIcons(enabled: boolean) {
  const manifest = siteManifestHref({ christmas: enabled });
  const touchIcon = siteAppleTouchIconHref({ christmas: enabled });

  document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]').forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (href === manifest) return;
    if (
      href === MANIFEST_DEFAULT
      || href === MANIFEST_CHRISTMAS
      || href === siteManifestHref({ christmas: !enabled })
    ) {
      link.href = manifest;
    }
  });

  document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (href === touchIcon) return;
    if (
      href.includes(PWA_ICON_192_DEFAULT)
      || href.includes(PWA_ICON_192_CHRISTMAS)
      || href.includes("icon-192.png")
    ) {
      link.href = touchIcon;
    }
  });
}

function applySeasonalIcons(enabled: boolean) {
  applySeasonalFavicon(enabled);
  applySeasonalPwaIcons(enabled);
}

function scheduleSeasonalFavicon(enabled: boolean) {
  applySeasonalIcons(enabled);
  const refreshMarks = () => applySeasonalIcons(enabled);
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