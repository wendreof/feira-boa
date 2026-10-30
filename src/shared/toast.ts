// Notificação curta no canto da tela (toast). Usada em alertas, canais e avaliações.
let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container?.isConnected) return container;
  container = document.createElement("div");
  container.className = "toast-stack";
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");
  document.body.append(container);
  return container;
}

export type ToastTone = "ok" | "error" | "info";

export function showToast(message: string, tone: ToastTone = "ok", timeoutMs = 3200): void {
  if (!message) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  ensureContainer().append(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 300);
  }, timeoutMs);
}