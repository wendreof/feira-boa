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

function setSuggestionStatus(message: string, state: "success" | "error" | "pending"): void {
  status.textContent = message;
  status.dataset.state = state;
}

form.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();

  if (honeypot.value) {
    setSuggestionStatus("Obrigado pela sua sugestão!", "success");
    form.reset();
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
    setSuggestionStatus("Sugestão enviada. Obrigado por ajudar a melhorar a Feira Boa!", "success");
  } catch (error) {
    setSuggestionStatus("Não foi possível enviar agora. Tente novamente em alguns instantes.", "error");
    console.error("Suggestion submission failed", error);
  } finally {
    submitButton.disabled = false;
  }
});
