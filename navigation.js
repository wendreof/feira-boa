(() => {
  const menuButton = document.querySelector("#menu-toggle");
  const closeButton = document.querySelector("#sidebar-close");
  const backdrop = document.querySelector("#sidebar-backdrop");
  const sidebar = document.querySelector("#app-sidebar");
  const mobileQuery = window.matchMedia("(max-width: 760px)");

  if (!(menuButton instanceof HTMLButtonElement) || !(sidebar instanceof HTMLElement)) return;

  document.body.classList.toggle("sidebar-collapsed", !mobileQuery.matches);
  sidebar.inert = mobileQuery.matches;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", mobileQuery.matches ? "Abrir menu" : "Expandir menu");

  const offersLink = sidebar.querySelector('[data-sidebar-link="offers"]');
  const currentUrl = new URL(window.location.href);
  if (currentUrl.pathname.endsWith("/index.html") && currentUrl.searchParams.get("view") !== "favorites") {
    offersLink?.setAttribute("aria-current", "page");
  }
  if (currentUrl.pathname.endsWith("/suggestions.html")) {
    sidebar.querySelector('[data-sidebar-link="suggestions"]')?.setAttribute("aria-current", "page");
  }

  function setMobileMenuOpen(open) {
    document.body.classList.toggle("sidebar-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    sidebar.inert = mobileQuery.matches && !open;

    if (open) {
      sidebar.querySelector("a")?.focus();
    } else if (mobileQuery.matches) {
      menuButton.focus();
    }
  }

  menuButton.addEventListener("click", () => {
    if (mobileQuery.matches) {
      setMobileMenuOpen(!document.body.classList.contains("sidebar-open"));
      return;
    }

    document.body.classList.toggle("sidebar-collapsed");
    const expanded = !document.body.classList.contains("sidebar-collapsed");
    menuButton.setAttribute("aria-expanded", String(expanded));
    menuButton.setAttribute("aria-label", expanded ? "Recolher menu" : "Expandir menu");
  });

  closeButton?.addEventListener("click", () => setMobileMenuOpen(false));
  backdrop?.addEventListener("click", () => setMobileMenuOpen(false));
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (mobileQuery.matches) setMobileMenuOpen(false);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      setMobileMenuOpen(false);
    }
  });

  mobileQuery.addEventListener("change", () => {
    setMobileMenuOpen(false);
    document.body.classList.toggle("sidebar-collapsed", !mobileQuery.matches);
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", mobileQuery.matches ? "Abrir menu" : "Expandir menu");
  });
})();
