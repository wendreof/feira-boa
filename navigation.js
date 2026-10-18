(() => {
  const menuButton = document.querySelector("#menu-toggle");
  const closeButton = document.querySelector("#sidebar-close");
  const backdrop = document.querySelector("#sidebar-backdrop");
  const sidebar = document.querySelector("#app-sidebar");
  const mobileQuery = window.matchMedia("(max-width: 760px)");

  if (!(menuButton instanceof HTMLButtonElement) || !(sidebar instanceof HTMLElement)) return;

  document.body.classList.remove("sidebar-collapsed");
  sidebar.inert = mobileQuery.matches;
  menuButton.setAttribute("aria-expanded", String(!mobileQuery.matches));
  menuButton.setAttribute("aria-label", mobileQuery.matches ? "Abrir menu" : "Recolher menu");

  const offersLink = sidebar.querySelector('[data-sidebar-link="offers"]');
  const currentUrl = new URL(window.location.href);
  const storesLink = document.createElement("a");
  storesLink.className = "sidebar-link";
  storesLink.href = "lojas.html";
  storesLink.setAttribute("aria-label", "Lojas");
  storesLink.setAttribute("data-sidebar-link", "stores");
  storesLink.innerHTML = '<span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 10h18M5 10v10h14V10M4 10l1.5-6h13L20 10M9 20v-6h6v6"/></svg></span><span>Lojas</span>';
  offersLink?.after(storesLink);
  if (currentUrl.pathname.endsWith("/index.html") && currentUrl.searchParams.get("view") !== "favorites") {
    offersLink?.setAttribute("aria-current", "page");
  }
  if (currentUrl.pathname.endsWith("/lojas.html")) storesLink.setAttribute("aria-current", "page");
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
    document.body.classList.remove("sidebar-collapsed");
    menuButton.setAttribute("aria-expanded", String(!mobileQuery.matches));
    menuButton.setAttribute("aria-label", mobileQuery.matches ? "Abrir menu" : "Recolher menu");
  });
})();
