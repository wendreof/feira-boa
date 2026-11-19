(() => {
  const menuButton = document.querySelector("#menu-toggle");
  const closeButton = document.querySelector("#sidebar-close");
  const backdrop = document.querySelector("#sidebar-backdrop");
  const sidebar = document.querySelector("#app-sidebar");
  const mobileQuery = window.matchMedia("(max-width: 760px)");
  let previouslyFocused = null;

  if (!(menuButton instanceof HTMLButtonElement) || !(sidebar instanceof HTMLElement)) return;

  const backgroundElements = [...document.body.children].filter((element) =>
    element instanceof HTMLElement
    && element !== sidebar
    && element !== backdrop
    && element.tagName !== "SCRIPT"
  );

  function setBackgroundInert(inert) {
    backgroundElements.forEach((element) => {
      element.inert = inert;
    });
  }

  // Canonical key: scripts/domain/supabase-auth-storage.mjs (Feira Boa project only).
  const SUPABASE_AUTH_STORAGE_KEY = "sb-muiuvmhzzbqflxznpnez-auth-token";
  // Keep in sync with scripts/domain/display-name-cache.mjs.
  const DISPLAY_NAME_CACHE_KEY = "feira-boa:display-name:v1";
  const DISPLAY_NAME_METADATA_KEYS = ["display_name", "full_name", "name", "given_name", "user_name", "preferred_username"];
  // Keep in sync with scripts/domain/provider-avatar-url.mjs
  const PROVIDER_AVATAR_KEYS = {
    twitter: ["avatar_url", "profile_image_url", "picture"],
    x: ["avatar_url", "profile_image_url", "picture"],
    google: ["picture", "avatar_url", "profile_image_url"],
  };
  const DEFAULT_AVATAR_KEYS = ["avatar_url", "picture", "profile_image_url"];

  function readStoredSession() {
    try {
      let session = JSON.parse(localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY) || "null");
      if (Array.isArray(session)) session = JSON.parse(session.join(""));
      if (!session?.access_token || !session?.user?.id) return null;
      const expiresAt = session.expires_at;
      if (typeof expiresAt === "number" && expiresAt * 1000 <= Date.now()) return null;
      return session;
    } catch {
      return null;
    }
  }

  function readStoredUserId() {
    const session = readStoredSession();
    return session ? String(session.user.id) : null;
  }

  if (!document.documentElement.dataset.authBootstrap) {
    document.documentElement.dataset.authBootstrap = readStoredUserId() ? "signed-in" : "guest";
  }

  function setAccountLinkState() {
    if (document.documentElement.dataset.authBootstrap !== "signed-in") return;
    try {
      const onAccountPage = window.location.pathname.endsWith("/account.html");
      document.querySelectorAll("#nav-account, #mobile-nav-account").forEach((link) => {
        if (!(link instanceof HTMLAnchorElement)) return;
        link.href = "account.html";
        link.setAttribute("aria-label", "Minha conta");
        if (onAccountPage) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
        link.querySelector("[data-account-label], [data-mobile-account-label]")?.replaceChildren("Minha conta");
      });
    } catch {
      // A malformed or unavailable session should not block navigation.
    }
  }

  function readCachedDisplayName(userId) {
    try {
      const raw = sessionStorage.getItem(DISPLAY_NAME_CACHE_KEY);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (entry.userId !== userId || typeof entry.name !== "string") return null;
      const name = entry.name.trim().replace(/\s+/g, " ");
      return name.length >= 2 ? name : null;
    } catch {
      return null;
    }
  }

  function displayNameFromMetadata(metadata) {
    if (!metadata || typeof metadata !== "object") return null;
    for (const key of DISPLAY_NAME_METADATA_KEYS) {
      const value = metadata[key];
      if (typeof value !== "string") continue;
      const name = value.trim().replace(/\s+/g, " ");
      if (name.length >= 2) return name;
    }
    return null;
  }

  function primeSidebarDisplayName() {
    const nameEl = document.querySelector("#sidebar-profile-name");
    if (!(nameEl instanceof HTMLElement)) return;
    if (document.documentElement.dataset.authBootstrap !== "signed-in") {
      nameEl.textContent = "";
      nameEl.hidden = true;
      return;
    }
    const session = readStoredSession();
    const userId = session ? String(session.user.id) : null;
    const name = (userId && readCachedDisplayName(userId)) || displayNameFromMetadata(session?.user?.user_metadata);
    nameEl.textContent = name ?? "";
    nameEl.hidden = !name;
  }

  setAccountLinkState();
  primeSidebarDisplayName();

  function resetGuestSidebarAvatar() {
    if (document.documentElement.dataset.authBootstrap === "guest") {
      const image = document.querySelector("#topbar-account-image");
      const fallback = document.querySelector("#topbar-account-fallback");
      if (image instanceof HTMLImageElement) {
        image.removeAttribute("src");
        image.style.opacity = "";
        image.hidden = true;
      }
      if (fallback instanceof HTMLElement) fallback.hidden = false;
    }
  }

  function readCachedAvatarPath(userId) {
    try {
      const raw = sessionStorage.getItem("feira-boa:avatar-path:v1");
      if (!raw) return undefined;
      const entry = JSON.parse(raw);
      if (entry.userId !== userId) return undefined;
      return entry.path ?? null;
    } catch {
      return undefined;
    }
  }

  // Keep in sync with scripts/domain/sidebar-avatar-src-cache.mjs
  const SIDEBAR_AVATAR_SRC_CACHE_KEY = "feira-boa:sidebar-avatar-src:v1";

  function readCachedSidebarAvatarSrc(userId) {
    try {
      const raw = sessionStorage.getItem(SIDEBAR_AVATAR_SRC_CACHE_KEY);
      if (!raw) return undefined;
      const entry = JSON.parse(raw);
      if (entry.userId !== userId) return undefined;
      const src = typeof entry.src === "string" ? entry.src.trim() : "";
      return /^https?:\/\//i.test(src) ? src : undefined;
    } catch {
      return undefined;
    }
  }

  function writeCachedSidebarAvatarSrc(userId, src) {
    try {
      const trimmed = typeof src === "string" ? src.trim() : "";
      if (!/^https?:\/\//i.test(trimmed)) return;
      sessionStorage.setItem(SIDEBAR_AVATAR_SRC_CACHE_KEY, JSON.stringify({ userId, src: trimmed }));
    } catch {
      // Private mode or quota.
    }
  }

  function oauthProviderFromUser(user) {
    const fromApp = user?.app_metadata?.provider;
    if (typeof fromApp === "string" && fromApp.trim()) return fromApp.trim().toLowerCase();
    const identity = user?.identities?.find((entry) => typeof entry?.provider === "string" && entry.provider.trim());
    if (identity?.provider) return identity.provider.trim().toLowerCase();
    return null;
  }

  function providerAvatarUrlFromMetadata(metadata, provider) {
    if (!metadata || typeof metadata !== "object") return null;
    const normalized = String(provider ?? "").toLowerCase().trim();
    const keys = PROVIDER_AVATAR_KEYS[normalized] ?? DEFAULT_AVATAR_KEYS;
    for (const key of keys) {
      const value = metadata[key];
      if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) return value.trim();
    }
    return null;
  }

  function avatarPublicUrl(path, sizePx) {
    const objectPath = path.trim().split("/").map((segment) => encodeURIComponent(segment)).join("/");
    const base = "https://muiuvmhzzbqflxznpnez.supabase.co";
    if (!sizePx) {
      return `${base}/storage/v1/object/public/avatars/${objectPath}`;
    }
    const params = new URLSearchParams({
      width: String(sizePx),
      height: String(sizePx),
      resize: "cover",
      quality: "80",
    });
    return `${base}/storage/v1/render/image/public/avatars/${objectPath}?${params}`;
  }

  // Keep in sync with scripts/domain/sidebar-avatar-prime.mjs
  function sidebarAvatarUrlsToTry(userId, remoteOAuthUrl) {
    const cachedSrc = readCachedSidebarAvatarSrc(userId);
    if (cachedSrc) return [cachedSrc];

    const cachedPath = readCachedAvatarPath(userId);
    if (typeof cachedPath === "string" && cachedPath.trim()) {
      const path = cachedPath.trim();
      return [avatarPublicUrl(path, 64), avatarPublicUrl(path)];
    }

    const oauth = typeof remoteOAuthUrl === "string" ? remoteOAuthUrl.trim() : "";
    if (/^https?:\/\//i.test(oauth) && (cachedPath === null || cachedPath === undefined)) {
      return [oauth];
    }
    return null;
  }

  function primeSidebarAvatarFromCache() {
    const userId = readStoredUserId();
    if (!userId) return;
    const image = document.querySelector("#topbar-account-image");
    const fallback = document.querySelector("#topbar-account-fallback");
    if (!(image instanceof HTMLImageElement)) return;

    const showPhoto = () => {
      image.referrerPolicy = "no-referrer";
      image.style.opacity = "";
      image.hidden = false;
      if (fallback instanceof HTMLElement) fallback.hidden = true;
      const settledSrc = image.currentSrc || image.src;
      if (settledSrc) writeCachedSidebarAvatarSrc(userId, settledSrc);
    };
    const showFallback = () => {
      image.style.opacity = "";
      image.removeAttribute("src");
      image.hidden = true;
      if (fallback instanceof HTMLElement) fallback.hidden = false;
    };

    const session = readStoredSession();
    const remote = providerAvatarUrlFromMetadata(
      session?.user?.user_metadata,
      oauthProviderFromUser(session?.user),
    );

    const urls = sidebarAvatarUrlsToTry(userId, remote);
    if (!urls || urls.length === 0) return;

    const bindLoad = (url, onError) => {
      image.loading = "eager";
      image.decoding = "async";
      const onLoad = () => showPhoto();
      const onFail = () => {
        image.removeEventListener("load", onLoad);
        if (onError) onError();
        else showFallback();
      };
      image.addEventListener("load", onLoad, { once: true });
      image.addEventListener("error", onFail, { once: true });
      image.hidden = false;
      image.style.opacity = "0";
      image.referrerPolicy = "no-referrer";
      image.src = url;
      if (image.complete && image.naturalWidth > 0) {
        showPhoto();
      } else if (image.complete && image.naturalWidth === 0) {
        onFail();
      }
    };

    const tryFromIndex = (index) => {
      const url = urls[index];
      if (!url) {
        showFallback();
        return;
      }
      const next = urls[index + 1];
      bindLoad(url, next ? () => tryFromIndex(index + 1) : undefined);
    };

    tryFromIndex(0);
  }

  resetGuestSidebarAvatar();
  if (document.documentElement.dataset.authBootstrap === "signed-in") {
    primeSidebarAvatarFromCache();
  }

  // No desktop o menu lateral fica sempre aberto; o botão só existe no mobile.
  document.body.classList.remove("sidebar-collapsed");
  sidebar.inert = mobileQuery.matches;
  menuButton.setAttribute("aria-expanded", String(!mobileQuery.matches));
  menuButton.setAttribute("aria-label", "Abrir menu");

  const offersLink = sidebar.querySelector('[data-sidebar-link="offers"]');
  const currentUrl = new URL(window.location.href);
  const storesLink = document.createElement("a");
  storesLink.className = "sidebar-link";
  storesLink.href = "lojas.html";
  storesLink.setAttribute("aria-label", "Lojas");
  storesLink.setAttribute("data-sidebar-link", "stores");
  storesLink.innerHTML = '<span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 10h18M5 10v10h14V10M4 10l1.5-6h13L20 10M9 20v-6h6v6"/></svg></span><span>Lojas</span>';
  offersLink?.after(storesLink);

  const suggestionsLink = sidebar.querySelector('[data-sidebar-link="suggestions"]');

  const isOffersPage = currentUrl.pathname === "/" || currentUrl.pathname.endsWith("/index.html");
  if (isOffersPage && currentUrl.searchParams.get("view") !== "favorites") {
    offersLink?.setAttribute("aria-current", "page");
  }
  if (currentUrl.pathname.endsWith("/lojas.html")) storesLink.setAttribute("aria-current", "page");
  if (currentUrl.pathname.endsWith("/suggestions.html")) {
    suggestionsLink?.setAttribute("aria-current", "page");
  }

  function setMobileMenuOpen(open) {
    const shouldOpen = mobileQuery.matches && open;
    if (shouldOpen && !document.body.classList.contains("sidebar-open")) {
      previouslyFocused = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : menuButton;
    }
    document.body.classList.toggle("sidebar-open", shouldOpen);
    menuButton.setAttribute("aria-expanded", String(shouldOpen));
    menuButton.setAttribute("aria-label", shouldOpen ? "Fechar menu" : "Abrir menu");
    sidebar.inert = mobileQuery.matches && !shouldOpen;
    setBackgroundInert(shouldOpen);

    if (shouldOpen) {
      (sidebar.querySelector("a") ?? closeButton)?.focus();
    } else if (mobileQuery.matches) {
      (previouslyFocused ?? menuButton).focus();
      previouslyFocused = null;
    }
  }

  menuButton.addEventListener("click", () => {
    if (!mobileQuery.matches) return;
    setMobileMenuOpen(!document.body.classList.contains("sidebar-open"));
  });

  closeButton?.addEventListener("click", () => setMobileMenuOpen(false));
  backdrop?.addEventListener("click", () => setMobileMenuOpen(false));
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (mobileQuery.matches) setMobileMenuOpen(false);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      event.preventDefault();
      setMobileMenuOpen(false);
      return;
    }
    if (event.key !== "Tab" || !mobileQuery.matches || !document.body.classList.contains("sidebar-open")) return;

    const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
    if (focusable.length === 0) {
      event.preventDefault();
      sidebar.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeInside = sidebar.contains(document.activeElement);
    if (event.shiftKey && (!activeInside || document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!activeInside || document.activeElement === last)) {
      event.preventDefault();
      first.focus();
    }
  });

  mobileQuery.addEventListener("change", () => {
    setMobileMenuOpen(false);
    document.body.classList.remove("sidebar-collapsed");
    menuButton.setAttribute("aria-expanded", String(!mobileQuery.matches));
    menuButton.setAttribute("aria-label", "Abrir menu");
  });
})();
