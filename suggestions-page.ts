import { submitSuggestion, type SuggestionCategory } from "./suggestions";
import { getCurrentUser } from "./account";
import { bindThemeToggle } from "./theme";

bindThemeToggle();

const accountLink = document.querySelector<HTMLAnchorElement>("#nav-account");
const accountLabel = accountLink?.querySelector<HTMLElement>("[data-account-label]");

void getCurrentUser()
  .then((user) => {
    if (!accountLink || !accountLabel) return;
    const signedIn = user !== null;
    const label = signedIn ? "Minha conta" : "Entrar";
    accountLabel.textContent = label;
    accountLink.setAttribute("aria-label", label);
    accountLink.href = signedIn ? "account.html" : "login.html";
  })
  .catch((error: unknown) => {
    console.error("Could not verify account navigation", error);
  });

const form = document.querySelector<HTMLFormElement>("#suggestion-form")!;
const category = document.querySelector<HTMLSelectElement>("#suggestion-category")!;
const message = document.querySelector<HTMLTextAreaElement>("#suggestion-message")!;
const honeypot = document.querySelector<HTMLInputElement>("#suggestion-website")!;
const submitButton = document.querySelector<HTMLButtonElement>("#suggestion-submit")!;
const status = document.querySelector<HTMLParagraphElement>("#suggestion-status")!;
const COOLDOWN_KEY = "feira-boa:suggestion-cooldown:v1";
const COOLDOWN_MS = 60_000;
let cooldownUntil = readCooldown();

function readCooldown(): number {
  try {
    const value = Number(localStorage.getItem(COOLDOWN_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function applyCooldown(): boolean {
  const remaining = cooldownUntil - Date.now();
  if (remaining <= 0) return false;
  submitButton.disabled = true;
  window.setTimeout(() => {
    if (Date.now() >= cooldownUntil) submitButton.disabled = false;
  }, remaining);
  return true;
}

function startCooldown(): void {
  cooldownUntil = Date.now() + COOLDOWN_MS;
  try {
    localStorage.setItem(COOLDOWN_KEY, String(cooldownUntil));
  } catch {
    // The button stays disabled for this page even when storage is unavailable.
  }
  applyCooldown();
}

function setSuggestionStatus(message: string, state: "success" | "error" | "pending"): void {
  status.textContent = message;
  status.dataset.state = state;
}

if (applyCooldown()) {
  const remaining = cooldownUntil - Date.now();
  const seconds = Math.ceil(remaining / 1000);
  setSuggestionStatus(`Aguarde ${seconds} segundos para enviar outra sugestão.`, "pending");
  window.setTimeout(() => {
    if (Date.now() >= cooldownUntil && status.dataset.state === "pending") {
      status.textContent = "";
      delete status.dataset.state;
    }
  }, remaining);
}

form.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();

  if (honeypot.value) {
    setSuggestionStatus("Obrigado pela sua sugestão!", "success");
    form.reset();
    return;
  }
  if (applyCooldown()) {
    const seconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
    setSuggestionStatus(`Aguarde ${seconds} segundos para enviar outra sugestão.`, "pending");
    return;
  }

  const trimmedMessage = message.value.trim();
  if (trimmedMessage.length < 10 || trimmedMessage.length > 2000) {
    setSuggestionStatus("Escreva uma mensagem entre 10 e 2.000 caracteres.", "error");
    message.focus();
    return;
  }

  submitButton.disabled = true;
  setSuggestionStatus("Enviando sua sugestão…", "pending");

  try {
    await submitSuggestion(category.value as SuggestionCategory, trimmedMessage);
    form.reset();
    startCooldown();
    setSuggestionStatus("Sugestão enviada. Obrigado por ajudar a melhorar a Feira Boa!", "success");
  } catch (error) {
    setSuggestionStatus("Não foi possível enviar agora. Tente novamente em alguns instantes.", "error");
    console.error("Suggestion submission failed", error);
  } finally {
    if (!applyCooldown()) submitButton.disabled = false;
  }
});
