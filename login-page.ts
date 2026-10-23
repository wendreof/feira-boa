import { errorMessage, getCurrentUser, resetPasswordForEmail, signIn, signInWithGoogle, signUp } from "./account";
import { bindThemeToggle } from "./theme";

bindThemeToggle();

const form = document.querySelector<HTMLFormElement>("#auth-form")!;
const nameInput = document.querySelector<HTMLInputElement>("#auth-name")!;
const nameLabel = document.querySelector<HTMLLabelElement>("#auth-name-label")!;
const emailInput = document.querySelector<HTMLInputElement>("#auth-email")!;
const passwordInput = document.querySelector<HTMLInputElement>("#auth-password")!;
const passwordToggle = document.querySelector<HTMLButtonElement>("#auth-password-toggle")!;
const title = document.querySelector<HTMLHeadingElement>("#auth-title")!;
const description = document.querySelector<HTMLParagraphElement>("#auth-description")!;
const submitButton = document.querySelector<HTMLButtonElement>("#auth-submit")!;
const switchLabel = document.querySelector<HTMLSpanElement>("#auth-switch-label")!;
const modeToggle = document.querySelector<HTMLButtonElement>("#auth-mode-toggle")!;
const googleButton = document.querySelector<HTMLButtonElement>("#google-signin")!;
const forgotRow = document.querySelector<HTMLParagraphElement>("#auth-forgot-row")!;
const forgotButton = document.querySelector<HTMLButtonElement>("#auth-forgot-password")!;
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

function setPasswordVisibility(visible: boolean): void {
  passwordInput.type = visible ? "text" : "password";
  passwordToggle.setAttribute("aria-label", visible ? "Ocultar senha" : "Mostrar senha");
  passwordToggle.setAttribute("aria-pressed", String(visible));
  passwordToggle.textContent = visible ? "Ocultar" : "Mostrar";
}

function looksLikeExistingAccount(message: string): boolean {
  return /already (been )?registered|already exists|user already|email not confirmed|ineligible/i.test(message);
}

function updateMode(): void {
  title.textContent = creatingAccount ? "Crie sua conta grátis." : "Bem-vindo de volta.";
  description.textContent = creatingAccount
    ? "Salve favoritos, avalie ofertas e acesse tudo em qualquer dispositivo."
    : "Entre para salvar favoritos, avaliar ofertas e manter tudo em qualquer dispositivo.";
  submitButton.textContent = creatingAccount ? "Criar conta" : "Entrar";
  switchLabel.textContent = creatingAccount ? "Já tem uma conta?" : "Ainda não tem conta?";
  modeToggle.textContent = creatingAccount ? "Entrar" : "Criar conta grátis";
  passwordInput.autocomplete = creatingAccount ? "new-password" : "current-password";
  nameInput.hidden = !creatingAccount;
  nameLabel.hidden = !creatingAccount;
  nameInput.required = creatingAccount;
  forgotRow.hidden = creatingAccount;
  setPasswordVisibility(false);
  setStatus("");
}

passwordToggle.addEventListener("click", () => {
  setPasswordVisibility(passwordInput.type === "password");
});

modeToggle.addEventListener("click", () => {
  creatingAccount = !creatingAccount;
  updateMode();
});

forgotButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    setStatus("Informe seu e-mail para receber o link de redefinição.");
    emailInput.focus();
    return;
  }

  forgotButton.disabled = true;
  setStatus("Enviando o link de redefinição…");
  try {
    await resetPasswordForEmail(email, getReturnPath());
    setStatus("Se este e-mail tiver uma conta, o link de redefinição já foi enviado. Confira sua caixa de entrada.");
    passwordInput.value = "";
    setPasswordVisibility(false);
  } catch (error) {
    setStatus(`Não foi possível enviar o link de redefinição: ${errorMessage(error)}`);
  } finally {
    forgotButton.disabled = false;
  }
});

googleButton.addEventListener("click", async () => {
  googleButton.disabled = true;
  setStatus("Abrindo o login do Google…");

  try {
    await signInWithGoogle(getReturnPath());
  } catch (error) {
    const message = errorMessage(error);
    setStatus(/provider|not enabled|not configured/i.test(message)
      ? "O login com Google ainda não está disponível. Use seu e-mail e senha."
      : `Não foi possível entrar com o Google: ${message}`);
    googleButton.disabled = false;
  }
});

form.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();
  submitButton.disabled = true;
  setStatus(creatingAccount ? "Criando sua conta…" : "Entrando…");

  try {
    const email = emailInput.value.trim();
    if (creatingAccount) {
      const displayName = nameInput.value.trim();
      if (displayName.length < 2) {
        setStatus("Informe como gostaria de ser chamado (mínimo de 2 letras).");
        nameInput.focus();
        return;
      }
      const result = await signUp(email, passwordInput.value, displayName);
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
    const message = errorMessage(error);
    if (creatingAccount && looksLikeExistingAccount(message)) {
      setStatus("Este e-mail já tem uma conta. Entre ou use “Esqueci a senha” para definir uma nova.");
      return;
    }
    setStatus(creatingAccount
      ? `Não foi possível criar a conta: ${message}`
      : `Não foi possível entrar: ${message}`);
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
