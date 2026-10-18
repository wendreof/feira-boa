import { errorMessage, getCurrentUser, signIn, signUp } from "./account";
import { bindThemeToggle } from "./theme";

bindThemeToggle();

const form = document.querySelector<HTMLFormElement>("#auth-form")!;
const emailInput = document.querySelector<HTMLInputElement>("#auth-email")!;
const passwordInput = document.querySelector<HTMLInputElement>("#auth-password")!;
const title = document.querySelector<HTMLHeadingElement>("#auth-title")!;
const description = document.querySelector<HTMLParagraphElement>("#auth-description")!;
const submitButton = document.querySelector<HTMLButtonElement>("#auth-submit")!;
const switchLabel = document.querySelector<HTMLSpanElement>("#auth-switch-label")!;
const modeToggle = document.querySelector<HTMLButtonElement>("#auth-mode-toggle")!;
const status = document.querySelector<HTMLParagraphElement>("#auth-status")!;

let creatingAccount = false;

function setStatus(message: string): void {
  status.textContent = message;
}

function getReturnPath(): string {
  const destination = new URLSearchParams(window.location.search).get("returnTo");
  if (!destination) return "index.html";

  try {
    const url = new URL(destination, window.location.origin);
    if (url.origin === window.location.origin && url.pathname !== "/login.html") {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // Ignore invalid redirect destinations and return to the home page.
  }

  return "index.html";
}

function updateMode(): void {
  title.textContent = creatingAccount ? "Crie sua conta grátis." : "Bem-vindo de volta.";
  description.textContent = creatingAccount
    ? "Salve suas ofertas favoritas e acesse em qualquer dispositivo."
    : "Entre para manter seus produtos favoritos salvos em qualquer dispositivo.";
  submitButton.textContent = creatingAccount ? "Criar conta" : "Entrar";
  switchLabel.textContent = creatingAccount ? "Já tem uma conta?" : "Ainda não tem conta?";
  modeToggle.textContent = creatingAccount ? "Entrar" : "Criar conta grátis";
  passwordInput.autocomplete = creatingAccount ? "new-password" : "current-password";
  setStatus("");
}

modeToggle.addEventListener("click", () => {
  creatingAccount = !creatingAccount;
  updateMode();
});

form.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();
  submitButton.disabled = true;
  setStatus(creatingAccount ? "Criando sua conta…" : "Entrando…");

  try {
    const email = emailInput.value.trim();
    if (creatingAccount) {
      const result = await signUp(email, passwordInput.value);
      passwordInput.value = "";
      if (result.confirmationRequired) {
        setStatus("Conta criada. Confira seu e-mail para confirmar o cadastro.");
      } else {
        window.location.replace(getReturnPath());
      }
    } else {
      await signIn(email, passwordInput.value);
      passwordInput.value = "";
      window.location.replace(getReturnPath());
    }
  } catch (error) {
    setStatus(creatingAccount
      ? `Não foi possível criar a conta: ${errorMessage(error)}`
      : `Não foi possível entrar: ${errorMessage(error)}`);
  } finally {
    submitButton.disabled = false;
  }
});

void getCurrentUser()
  .then((user) => {
    if (user) window.location.replace(getReturnPath());
  })
  .catch((error: unknown) => {
    setStatus(`Não foi possível verificar sua sessão: ${errorMessage(error)}`);
  });
