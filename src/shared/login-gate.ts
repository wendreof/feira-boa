// Convite de login para paginas publicas quando nao ha sessao.
// Ativa-se apenas em <body data-login-gate>; a pagina inicial usa login-prompt.ts.
import { supabase } from "../supabase-client";

const DIALOG_HTML = `
<div class="login-prompt-card">
  <span class="login-prompt-kicker">Sua conta</span>
  <h2 id="login-gate-title">Entre na sua conta</h2>
  <p id="login-gate-description">Entre para salvar favoritos, criar alertas de preço e avaliar ofertas. Tudo fica sincronizado entre os seus dispositivos.</p>
  <div class="login-prompt-actions">
    <button class="login-prompt-secondary" id="login-gate-cancel" type="button">Agora não</button>
    <button class="login-prompt-primary" id="login-gate-continue" type="button">Entrar ou criar conta</button>
  </div>
</div>`;

function loginUrl(): URL {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const url = new URL("login.html", window.location.href);
  url.searchParams.set("returnTo", returnTo);
  return url;
}

function mountDialog(): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "login-prompt";
  dialog.setAttribute("aria-labelledby", "login-gate-title");
  dialog.setAttribute("aria-describedby", "login-gate-description");
  dialog.innerHTML = DIALOG_HTML;
  document.body.append(dialog);
  return dialog;
}

async function showGateWhenSignedOut(): Promise<void> {
  if (!document.body.hasAttribute("data-login-gate")) return;
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session) return;

  const dialog = mountDialog();
  dialog.querySelector<HTMLButtonElement>("#login-gate-cancel")?.addEventListener("click", () => dialog.close());
  dialog.querySelector<HTMLButtonElement>("#login-gate-continue")?.addEventListener("click", () => {
    window.location.assign(loginUrl());
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  if (typeof dialog.showModal === "function") dialog.showModal();
}

void showGateWhenSignedOut().catch((error: unknown) => {
  console.warn("Could not check the session for the login prompt.", error);
});
