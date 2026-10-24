import { reactionLoginDialog, reactionLoginCancel, reactionLoginContinue, reactionLoginTitle, reactionLoginDescription } from "./dom";
import { type LoginIntent } from "./state";

let reactionLoginTrigger: HTMLElement | null = null;
let pendingLoginCancel: (() => void) | null = null;

function loginUrlForCurrentPage(): URL {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const loginUrl = new URL("login.html", window.location.href);
  loginUrl.searchParams.set("returnTo", returnTo);
  return loginUrl;
}


const LOGIN_INTENT_COPY: Record<LoginIntent, { title: string; description: string; confirm: string }> = {
  reaction: {
    title: "Entre para avaliar",
    description: "Para curtir uma oferta, entre na sua conta. Seu voto fica salvo e ajuda outros compradores.",
    confirm: "Entre ou crie uma conta para curtir esta oferta.",
  },
  favorite: {
    title: "Entre para salvar favoritos",
    description: "Para salvar ofertas nos favoritos, entre na sua conta. Tudo fica sincronizado entre os seus dispositivos.",
    confirm: "Entre ou crie uma conta para salvar esta oferta nos favoritos.",
  },
};

export function askForLogin(trigger: HTMLElement, intent: LoginIntent, onCancel?: () => void): void {
  const copy = LOGIN_INTENT_COPY[intent];
  reactionLoginTitle.textContent = copy.title;
  reactionLoginDescription.textContent = copy.description;
  pendingLoginCancel = onCancel ?? null;
  if (typeof reactionLoginDialog.showModal !== "function") {
    pendingLoginCancel = null;
    if (window.confirm(copy.confirm)) {
      window.location.assign(loginUrlForCurrentPage());
    } else {
      onCancel?.();
    }
    return;
  }
  if (reactionLoginDialog.open) {
    pendingLoginCancel = null;
    return;
  }
  reactionLoginTrigger = trigger;
  reactionLoginDialog.showModal();
}

export function bindLoginDialog(): void {
  reactionLoginCancel.addEventListener("click", () => reactionLoginDialog.close());
  reactionLoginContinue.addEventListener("click", () => {
    const loginUrl = loginUrlForCurrentPage();
    pendingLoginCancel = null;
    reactionLoginDialog.close();
    window.location.assign(loginUrl);
  });
  reactionLoginDialog.addEventListener("click", (event: MouseEvent) => {
    if (event.target === reactionLoginDialog) reactionLoginDialog.close();
  });
  reactionLoginDialog.addEventListener("close", () => {
    const cancel = pendingLoginCancel;
    pendingLoginCancel = null;
    if (reactionLoginTrigger?.isConnected) reactionLoginTrigger.focus();
    reactionLoginTrigger = null;
    cancel?.();
  });
}
