import { appState } from "./state";
import { topbar, accountAccess, accountPanel, navAccountLink, navAccountLabel, mobileNavAccountLink, mobileNavAccountLabel, accountDescription, accountStatus, topbarAccount, topbarAccountImage, topbarAccountFallback, topbarHello } from "./dom";
import { AVATAR_SIZE, loadAvatar, readCachedAvatarPath, setAvatarImage, writeCachedAvatarPath } from "../avatar";
import { loadDisplayName } from "../account";

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
  accountPanel.hidden = signedIn;
  accountAccess.hidden = signedIn;
  navAccountLabel.textContent = label;
  navAccountLink.setAttribute("aria-label", label);
  navAccountLink.setAttribute("href", href);
  mobileNavAccountLabel.textContent = label;
  mobileNavAccountLink.setAttribute("aria-label", label);
  mobileNavAccountLink.setAttribute("href", href);
  if (topbarAccount) {
    topbarAccount.hidden = !signedIn;
    topbarAccount.setAttribute("href", "account.html");
    topbarAccount.setAttribute("aria-label", "Minha conta");
    if (signedIn) {
      // Ícone de pessoa até a foto chegar (ou se não houver).
      if (!topbarAccountImage?.src) clearTopbarAvatar();
    } else {
      clearTopbarAvatar();
    }
  }
  if (topbarHello && !signedIn) topbarHello.hidden = true;
  accountDescription.textContent = signedIn
    ? "Seus favoritos já estão sincronizados com a sua conta."
    : "Entre ou crie uma conta grátis para salvar seus favoritos.";
  if (signedIn) setAccountStatus("Conta conectada. Seus favoritos estão sincronizados.");
}

function clearTopbarAvatar(): void {
  if (topbarAccountImage) {
    topbarAccountImage.removeAttribute("src");
    topbarAccountImage.hidden = true;
  }
  if (topbarAccountFallback) topbarAccountFallback.hidden = false;
}

export function primeTopbarAvatar(userId: string): void {
  const cached = readCachedAvatarPath(userId, sessionStorage);
  if (cached === undefined) return;
  if (cached && topbarAccountImage) {
    setAvatarImage(topbarAccountImage, cached, AVATAR_SIZE.topbar);
    if (topbarAccountFallback) topbarAccountFallback.hidden = true;
  } else {
    clearTopbarAvatar();
  }
}

export async function refreshTopbarAvatar(userId: string, knownPath?: string | null): Promise<void> {
  try {
    const path = knownPath !== undefined ? knownPath : await loadAvatar(userId);
    writeCachedAvatarPath(userId, path, sessionStorage);
    if (path && topbarAccountImage) {
      setAvatarImage(topbarAccountImage, path, AVATAR_SIZE.topbar);
      if (topbarAccountFallback) topbarAccountFallback.hidden = true;
    } else {
      clearTopbarAvatar();
    }
  } catch (error) {
    console.warn("Could not load the topbar avatar.", error);
    if (knownPath === undefined) clearTopbarAvatar();
  }
  try {
    const name = await loadDisplayName(userId);
    if (topbarHello) {
      topbarHello.textContent = name ? `Olá, ${name}!` : "";
      topbarHello.hidden = !name;
    }
  } catch (error) {
    console.warn("Could not load the display name.", error);
    if (topbarHello) topbarHello.hidden = true;
  }
}
