export function resolveDefaultViewMode(savedValue, isMobileViewport) {
  if (isMobileViewport) return "list";
  if (savedValue === "list" || savedValue === "grid") return savedValue;
  return "grid";
}
