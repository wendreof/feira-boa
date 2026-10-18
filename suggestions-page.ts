import { submitSuggestion, type SuggestionCategory } from "./suggestions";
import { bindThemeToggle } from "./theme";

bindThemeToggle();

const form = document.querySelector<HTMLFormElement>("#suggestion-form")!;
const category = document.querySelector<HTMLSelectElement>("#suggestion-category")!;
const message = document.querySelector<HTMLTextAreaElement>("#suggestion-message")!;
const honeypot = document.querySelector<HTMLInputElement>("#suggestion-website")!;
const submitButton = document.querySelector<HTMLButtonElement>("#suggestion-submit")!;
const status = document.querySelector<HTMLParagraphElement>("#suggestion-status")!;

form.addEventListener("submit", async (event: SubmitEvent) => {
  event.preventDefault();

  if (honeypot.value) {
    status.textContent = "Obrigado pela sua sugestão!";
    form.reset();
    return;
  }

  const trimmedMessage = message.value.trim();
  if (trimmedMessage.length < 10 || trimmedMessage.length > 2000) {
    status.textContent = "Escreva uma mensagem entre 10 e 2.000 caracteres.";
    message.focus();
    return;
  }

  submitButton.disabled = true;
  status.textContent = "Enviando sua sugestão…";

  try {
    await submitSuggestion(category.value as SuggestionCategory, trimmedMessage);
    form.reset();
    status.textContent = "Sugestão enviada. Obrigado por ajudar a melhorar a Feira Boa!";
  } catch (error) {
    status.textContent = "Não foi possível enviar agora. Tente novamente em alguns instantes.";
    console.error("Suggestion submission failed", error);
  } finally {
    submitButton.disabled = false;
  }
});
