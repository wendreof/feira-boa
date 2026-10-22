import { errorMessage } from "./errors";
import { getCurrentUser } from "./account";
import { bindThemeToggle } from "./theme";
import { supabase } from "./supabase-client";
import {
  detectSuggestionGuard,
  submitSuggestion,
  SUGGESTION_GUARD_MESSAGES,
  type SuggestionCategory,
} from "./suggestions";

bindThemeToggle();

const accountLink = document.querySelector<HTMLAnchorElement>("#nav-account");
const accountLabel = accountLink?.querySelector<HTMLElement>("[data-account-label]");

const form = document.querySelector<HTMLFormElement>("#suggestion-form")!;
const category = document.querySelector<HTMLSelectElement>("#suggestion-category")!;
const message = document.querySelector<HTMLTextAreaElement>("#suggestion-message")!;
const honeypot = document.querySelector<HTMLInputElement>("#suggestion-website")!;
const submitButton = document.querySelector<HTMLButtonElement>("#suggestion-submit")!;
const status = document.querySelector<HTMLParagraphElement>("#suggestion-status")!;
const description = document.querySelector<HTMLElement>("#suggestion-description")!;
const COOLDOWN_MS = 60_000;
const COOLDOWN_KEY_PREFIX = "feira-boa:suggestion-cooldown:v2:";
let cooldownUntil = 0;
let currentUserId: string | null = null;

function cooldownKey(userId: string): string {
  return `${COOLDOWN_KEY_PREFIX}${userId}`;
}

function readCooldown(userId: string): number {
  try {
    const value = Number(localStorage.getItem(cooldownKey(userId)));
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

function startCooldown(userId: string): void {
  cooldownUntil = Date.now() + COOLDOWN_MS;
  try {
    localStorage.setItem(cooldownKey(userId), String(cooldownUntil));
  } catch {
    // The button stays disabled for this page even when storage is unavailable.
  }
  applyCooldown();
}

function setSuggestionStatus(message: string, state: "success" | "error" | "pending"): void {
  status.textContent = message;
  status.dataset.state = state;
}

function redirectToLogin(): void {
  window.location.replace("login.html?returnTo=suggestions.html");
}

function showCooldownNotice(): void {
  const seconds = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
  setSuggestionStatus(`Aguarde ${seconds} segundos para enviar outra sugestão.`, "pending");
}

function enableForm(userId: string): void {
  currentUserId = userId;
  cooldownUntil = readCooldown(userId);
  if (applyCooldown()) {
    showCooldownNotice();
    window.setTimeout(() => {
      if (Date.now() >= cooldownUntil && status.dataset.state === "pending") {
        status.textContent = "";
        delete status.dataset.state;
      }
    }, cooldownUntil - Date.now());
  }
}

void getCurrentUser()
  .then((user) => {
    if (accountLink && accountLabel) {
      const label = user ? "Minha conta" : "Entrar";
      accountLabel.textContent = label;
      accountLink.setAttribute("aria-label", label);
      accountLink.href = user ? "account.html" : "login.html";
    }
    if (!user) {
      description.textContent = "Entre na sua conta para enviar uma sugestão.";
      redirectToLogin();
      return;
    }
    enableForm(user.id);
  })
  .catch((error: unknown) => {
    console.error("Could not verify the signed-in account", error);
    description.textContent = "Não foi possível verificar sua sessão. Tente novamente em alguns instantes.";
    setSuggestionStatus(errorMessage(error), "error");
  });

form.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();

  if (!currentUserId) {
    redirectToLogin();
    return;
  }
  if (applyCooldown()) {
    showCooldownNotice();
    return;
  }

  const trimmedMessage = message.value.trim();
  if (trimmedMessage.length < 10 || trimmedMessage.length > 2000) {
    setSuggestionStatus("Escreva uma mensagem entre 10 e 2.000 caracteres.", "error");
    message.focus();
    return;
  }

  const userId = currentUserId;
  submitButton.disabled = true;
  setSuggestionStatus("Enviando sua sugestão…", "pending");

  try {
    await submitSuggestion(supabase, {
      category: category.value as SuggestionCategory,
      message: trimmedMessage,
      userId,
      honeypot: honeypot.value,
    });
    form.reset();
    startCooldown(userId);
    setSuggestionStatus("Sugestão enviada. Obrigado por ajudar a melhorar a Feira Boa!", "success");
  } catch (error) {
    const guard = detectSuggestionGuard(error);
    if (guard === "honeypot") {
      form.reset();
      setSuggestionStatus("Obrigado pela sua sugestão!", "success");
    } else if (guard === "cooldown") {
      startCooldown(userId);
      setSuggestionStatus(SUGGESTION_GUARD_MESSAGES.cooldown, "error");
    } else if (guard === "dailyLimit") {
      setSuggestionStatus(SUGGESTION_GUARD_MESSAGES.dailyLimit, "error");
    } else if (guard === "signIn") {
      setSuggestionStatus(SUGGESTION_GUARD_MESSAGES.signIn, "error");
    } else {
      setSuggestionStatus(`Não foi possível enviar agora: ${errorMessage(error)}`, "error");
      console.error("Suggestion submission failed", error);
    }
  } finally {
    if (!applyCooldown()) submitButton.disabled = false;
  }
});
