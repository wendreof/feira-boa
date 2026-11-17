import { appState } from "./state";
import { topbar, accountAccess, accountPanel, navAccountLink, navAccountLabel, mobileNavAccountLink, mobileNavAccountLabel, accountDescription, accountStatus, topbarAccount, topbarAccountImage, topbarAccountFallback, topbarHello } from "./dom";
import { AVATAR_LOAD_TIMEOUT_MS, AVATAR_SIZE, isStorageAvatarPath, loadAvatar, readCachedAvatarPath, setAvatarImage, writeCachedAvatarPath } from "../avatar";
import { hideSpinner, showSpinner } from "../loading";
import { loadDisplayName } from "../account";
import { clearCachedDisplayName, writeCachedDisplayName } from "../../scripts/domain/display-name-cache.mjs";

export function bindCompactTopbar(): void {
  // O cabeçalho encolhe ao rolar para liberar espaço na tela.
  const compactQuery = window.matchMedia("(max-width: 760px)");
  let compactPending = false;
  function updateCompactTopbar(): void {
    if (compactPending) return;
    compactPending = true;
    window.requestAnimationFrame(() => {
      compactPending = false;
      topbar.classList.toggle("is-compact", window.scrollY > 40);
    });
  }
  window.addEventListener("scroll", updateCompactTopbar, { passive: true });
  compactQuery.addEventListener?.("change", updateCompactTopbar);
}

export function setAccountStatus(message: string): void {
  accountStatus.textContent = message;
}

export function updateAccountControls(): void {
  const signedIn = appState.currentUserId !== null;
  document.documentElement.dataset.authBootstrap = signedIn ? "signed-in" : "guest";
  const label = signedIn ? "Minha conta" : "Entrar";
  const href = signedIn ? "account.html" : "login.html";
  accountPanel.hidden = true;
  accountAccess.hidden = signedIn;
  navAccountLabel.textContent = label;
  navAccountLink.setAttribute("aria-label", label);
  navAccountLink.setAttribute("href", href);
  mobileNavAccountLabel.textContent = label;
  mobileNavAccountLink.setAttribute("aria-label", label);
  mobileNavAccountLink.setAttribute("href", href);
  if (!signedIn) {
    clearTopbarAvatar();
    clearCachedDisplayName(sessionStorage);
    if (topbarHello) {
      topbarHello.textContent = "";
      topbarHello.hidden = true;
    }
  } else if (topbarAccountImage && !topbarAccountImage.getAttribute("src")) {
    clearTopbarAvatar();
  }
  accountDescription.textContent = signedIn
    ? "Seus favoritos já estão sincronizados com a sua conta."
    : "Entre ou crie uma conta grátis para salvar seus favoritos.";
  if (signedIn) setAccountStatus("Conta conectada. Seus favoritos estão sincronizados.");
}

function clearTopbarAvatar(): void {
  if (topbarAccountImage) {
    topbarAccountImage.removeAttribute("src");
    topbarAccountImage.style.opacity = "";
    topbarAccountImage.hidden = true;
  }
  if (topbarAccountFallback) topbarAccountFallback.hidden = false;
}

function settleTopbarAvatarFallback(visible: boolean): void {
  if (visible) {
    if (topbarAccountFallback) topbarAccountFallback.hidden = true;
    return;
  }
  clearTopbarAvatar();
}

function setTopbarAvatarPath(path: string | null): void {
  if (!topbarAccountImage) return;
  if (!path) {
    clearTopbarAvatar();
    return;
  }
  if (!isStorageAvatarPath(path)) {
    setTopbarRemoteAvatar(path);
    return;
  }
  setAvatarImage(topbarAccountImage, path, AVATAR_SIZE.topbar, {
    onSettled: settleTopbarAvatarFallback,
  });
}

function setTopbarRemoteAvatar(url: string): void {
  const image = topbarAccountImage;
  if (!image) return;
  const host = image.parentElement;
  image.removeAttribute("src");
  image.hidden = false;
  image.style.opacity = "0";
  showSpinner(host);
  let settled = false;
  const settle = (visible: boolean): void => {
    if (settled) return;
    settled = true;
    window.clearTimeout(loadTimeout);
    image.onload = null;
    image.onerror = null;
    hideSpinner(host);
    image.style.opacity = "";
    if (visible) {
      image.hidden = false;
      if (topbarAccountFallback) topbarAccountFallback.hidden = true;
      return;
    }
    clearTopbarAvatar();
  };
  const loadTimeout = window.setTimeout(() => settle(false), AVATAR_LOAD_TIMEOUT_MS);
  image.referrerPolicy = "no-referrer";
  image.onload = () => settle(true);
  image.onerror = () => settle(false);
  image.src = url;
  if (image.complete && image.naturalWidth > 0) settle(true);
}

export function primeTopbarAvatar(userId: string): void {
  const cached = readCachedAvatarPath(userId, sessionStorage);
  if (cached === undefined) return;
  if (cached) {
    setTopbarAvatarPath(cached);
  } else {
    clearTopbarAvatar();
  }
}

export async function refreshTopbarAvatar(
  userId: string,
  knownPath?: string | null,
  providerAvatarUrl?: string | null,
): Promise<void> {
  try {
    const path = knownPath !== undefined ? knownPath : await loadAvatar(userId);
    writeCachedAvatarPath(userId, path, sessionStorage);
    if (path) {
      if (!topbarAccountImage) return;
      if (!isStorageAvatarPath(path)) {
        setTopbarRemoteAvatar(path);
      } else {
        setAvatarImage(topbarAccountImage, path, AVATAR_SIZE.topbar, {
          onSettled: (visible) => {
            if (visible) {
              if (topbarAccountFallback) topbarAccountFallback.hidden = true;
              return;
            }
            if (providerAvatarUrl) setTopbarRemoteAvatar(providerAvatarUrl);
            else clearTopbarAvatar();
          },
        });
      }
    } else if (providerAvatarUrl) {
      setTopbarRemoteAvatar(providerAvatarUrl);
    } else {
      clearTopbarAvatar();
    }
  } catch (error) {
    console.warn("Could not load the topbar avatar.", error);
    if (providerAvatarUrl) setTopbarRemoteAvatar(providerAvatarUrl);
    else if (knownPath === undefined) clearTopbarAvatar();
  }
  try {
    const name = await loadDisplayName(userId);
    writeCachedDisplayName(userId, name, sessionStorage);
    if (topbarHello) {
      topbarHello.textContent = name ?? "";
      topbarHello.hidden = !name;
    }
    if (name && topbarAccount) topbarAccount.setAttribute("aria-label", name);
  } catch (error) {
    console.warn("Could not load the display name.", error);
    if (topbarHello) topbarHello.hidden = true;
  }
}
