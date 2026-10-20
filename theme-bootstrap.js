(() => {
  try {
    const saved = localStorage.getItem("feira-boa:theme:v1");
    const theme = saved === "dark" || saved === "light"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (theme === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
  } catch {
    // Keep the default theme when storage is unavailable.
  }
})();
