(() => {
  const menuButton = document.querySelector("#menu-toggle");
  const closeButton = document.querySelector("#sidebar-close");
  const backdrop = document.querySelector("#sidebar-backdrop");
  const sidebar = document.querySelector("#app-sidebar");
  const mobileQuery = window.matchMedia("(max-width: 760px)");
  let previouslyFocused = null;

  if (!(menuButton instanceof HTMLButtonElement) || !(sidebar instanceof HTMLElement)) return;

  const backgroundElements = [...document.body.children].filter((element) =>
    element instanceof HTMLElement
    && element !== sidebar
    && element !== backdrop
    && element.tagName !== "SCRIPT"
  );

  function setBackgroundInert(inert) {
    backgroundElements.forEach((element) => {
      element.inert = inert;
    });
  }

  function setAccountLinkState() {
    try {
      const storageKey = Object.keys(localStorage).find((key) => /^sb-.*-auth-token$/.test(key));
      if (!storageKey) return;
      let session = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(session)) session = JSON.parse(session.join(""));
      if (!session?.access_token || !session?.user) return;
      document.querySelectorAll("#nav-account, #mobile-nav-account").forEach((link) => {
        if (!(link instanceof HTMLAnchorElement)) return;
        link.href = "account.html";
        link.setAttribute("aria-label", "Minha conta");
        link.querySelector("[data-account-label], [data-mobile-account-label]")?.replaceChildren("Minha conta");
      });
    } catch {
      // A malformed or unavailable session should not block navigation.
    }
  }

  setAccountLinkState();

  // No desktop o menu lateral fica sempre aberto; o botão só existe no mobile.
  document.body.classList.remove("sidebar-collapsed");
  sidebar.inert = mobileQuery.matches;
  menuButton.setAttribute("aria-expanded", String(!mobileQuery.matches));
  menuButton.setAttribute("aria-label", "Abrir menu");

  const offersLink = sidebar.querySelector('[data-sidebar-link="offers"]');
  const currentUrl = new URL(window.location.href);
  const storesLink = document.createElement("a");
  storesLink.className = "sidebar-link";
  storesLink.href = "lojas.html";
  storesLink.setAttribute("aria-label", "Lojas");
  storesLink.setAttribute("data-sidebar-link", "stores");
  storesLink.innerHTML = '<span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 10h18M5 10v10h14V10M4 10l1.5-6h13L20 10M9 20v-6h6v6"/></svg></span><span>Lojas</span>';
  offersLink?.after(storesLink);

  const suggestionsLink = sidebar.querySelector('[data-sidebar-link="suggestions"]');
  const termsLink = document.createElement("a");
  termsLink.className = "sidebar-link";
  termsLink.href = "termos.html";
  termsLink.setAttribute("aria-label", "Termos de uso");
  termsLink.setAttribute("data-sidebar-link", "terms");
  termsLink.innerHTML = '<span aria-hidden="true">§</span><span>Termos</span>';
  suggestionsLink?.after(termsLink);

  const isOffersPage = currentUrl.pathname === "/" || currentUrl.pathname.endsWith("/index.html");
  if (isOffersPage && currentUrl.searchParams.get("view") !== "favorites") {
    offersLink?.setAttribute("aria-current", "page");
  }
  if (currentUrl.pathname.endsWith("/lojas.html")) storesLink.setAttribute("aria-current", "page");
  if (currentUrl.pathname.endsWith("/suggestions.html")) {
    suggestionsLink?.setAttribute("aria-current", "page");
  }
  if (currentUrl.pathname.endsWith("/termos.html")) termsLink.setAttribute("aria-current", "page");

  function setMobileMenuOpen(open) {
    const shouldOpen = mobileQuery.matches && open;
    if (shouldOpen && !document.body.classList.contains("sidebar-open")) {
      previouslyFocused = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : menuButton;
    }
    document.body.classList.toggle("sidebar-open", shouldOpen);
    menuButton.setAttribute("aria-expanded", String(shouldOpen));
    menuButton.setAttribute("aria-label", shouldOpen ? "Fechar menu" : "Abrir menu");
    sidebar.inert = mobileQuery.matches && !shouldOpen;
    setBackgroundInert(shouldOpen);

    if (shouldOpen) {
      (sidebar.querySelector("a") ?? closeButton)?.focus();
    } else if (mobileQuery.matches) {
      (previouslyFocused ?? menuButton).focus();
      previouslyFocused = null;
    }
  }

  menuButton.addEventListener("click", () => {
    if (!mobileQuery.matches) return;
    setMobileMenuOpen(!document.body.classList.contains("sidebar-open"));
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
      event.preventDefault();
      setMobileMenuOpen(false);
      return;
    }
    if (event.key !== "Tab" || !mobileQuery.matches || !document.body.classList.contains("sidebar-open")) return;

    const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
    if (focusable.length === 0) {
      event.preventDefault();
      sidebar.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeInside = sidebar.contains(document.activeElement);
    if (event.shiftKey && (!activeInside || document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!activeInside || document.activeElement === last)) {
      event.preventDefault();
      first.focus();
    }
  });

  mobileQuery.addEventListener("change", () => {
    setMobileMenuOpen(false);
    document.body.classList.remove("sidebar-collapsed");
    menuButton.setAttribute("aria-expanded", String(!mobileQuery.matches));
    menuButton.setAttribute("aria-label", "Abrir menu");
  });
})();
