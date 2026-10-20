export type ThemePreference = "light" | "dark";

const THEME_STORAGE_KEY = "feira-boa:theme:v1";

function currentTheme(): ThemePreference {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function storedTheme(): ThemePreference | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): ThemePreference {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ThemePreference, persist = true): void {
  document.documentElement.dataset.theme = theme;
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === "dark" ? "#121814" : "#f5f6f1";
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The selected theme remains active for this page when storage is unavailable.
    }
  }
  updateThemeButton(theme);
}

function updateThemeButton(theme: ThemePreference): void {
  const button = document.querySelector<HTMLButtonElement>("#theme-toggle");
  if (!button) return;
  button.setAttribute("aria-pressed", String(theme === "dark"));
  button.setAttribute("aria-label", theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
  button.querySelector<HTMLElement>("[data-theme-icon]")!.textContent = theme === "dark" ? "☀" : "☾";
  button.querySelector<HTMLElement>("[data-theme-label]")!.textContent = theme === "dark" ? "Claro" : "Escuro";
}

export function bindThemeToggle(onChange?: (theme: ThemePreference) => void): void {
  const button = document.querySelector<HTMLButtonElement>("#theme-toggle");
  const initialTheme = storedTheme() ?? systemTheme();
  applyTheme(initialTheme, false);
  if (!button) return;

  button.addEventListener("click", () => {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    onChange?.(nextTheme);
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (storedTheme() !== null) return;
    applyTheme(event.matches ? "dark" : "light", false);
  });
}
