const SPINNER_CLASS = "spinner";

function clearSpinner(host: HTMLElement | null): void {
  host?.querySelector(`.${SPINNER_CLASS}`)?.remove();
}

export function showSpinner(host: HTMLElement | null): void {
  if (!host) return;
  clearSpinner(host);
  const spinner = document.createElement("span");
  spinner.className = SPINNER_CLASS;
  spinner.setAttribute("aria-hidden", "true");
  host.append(spinner);
}

export function hideSpinner(host: HTMLElement | null): void {
  clearSpinner(host);
}

export async function withSpinner<T>(host: HTMLElement | null, task: () => Promise<T>): Promise<T> {
  showSpinner(host);
  try {
    return await task();
  } finally {
    hideSpinner(host);
  }
}
