// Rodape unico do site. Paginas trazem <footer class="footer" data-site-footer></footer>
// e carregam site-footer.js; o conteudo vem daqui para nao duplicar markup.
// __SITE_PACKAGE_VERSION__ is injected at bundle time from package.json (see scripts/inject-site-version.mjs).

function siteVersionPrefix(version: string): string {
  const core = version.trim().replace(/^v/i, "");
  return core ? `v${core}` : "v0.0.0";
}

const PACKAGE_VERSION = siteVersionPrefix(__SITE_PACKAGE_VERSION__);
const PACKAGE_VERSION_RAW = PACKAGE_VERSION.replace(/^v/, "");

const FOOTER_HTML = `<span class="footer-brand"><strong>Feira Boa</strong> · Economia que faz bem · São João da Boa Vista</span><span>Confira preço, estoque e condições na loja.</span><span class="footer-disclaimer">As ofertas podem mudar ou terminar antes da data informada. Confirme com a loja; a Feira Boa não garante a disponibilidade nem se responsabiliza por ofertas encerradas.</span><a class="footer-link" href="termos.html#privacidade">Termos e privacidade</a><details class="build-version" data-site-version="${PACKAGE_VERSION_RAW}"><summary id="site-version" aria-label="Versão do site">${PACKAGE_VERSION}</summary><span id="site-build-details">Carregando build…</span></details><span class="footer-made">Made with <span aria-hidden="true">♥</span> by WLF Techs</span>`;

export function renderSiteFooter(): void {
  document.querySelectorAll<HTMLElement>("[data-site-footer]").forEach((footer) => {
    footer.innerHTML = FOOTER_HTML;
  });
}

renderSiteFooter();
