// Rodape unico do site. Paginas trazem <footer class="footer" data-site-footer></footer>
// e carregam site-footer.js; o conteudo vem daqui para nao duplicar markup.
const FOOTER_HTML = `<span class="footer-brand"><strong>Feira Boa</strong> · São João da Boa Vista</span><span>Confira preço, estoque e condições na loja.</span><span class="footer-disclaimer">As ofertas podem mudar ou terminar antes da data informada. Confirme com a loja; a Feira Boa não garante a disponibilidade nem se responsabiliza por ofertas encerradas.</span><a class="footer-link" href="termos.html">Termos de uso</a><details class="build-version"><summary id="site-version">Versão</summary><span id="site-build-details">Carregando build…</span></details><span class="footer-made">Made with <span aria-hidden="true">♥</span> by WLF Techs</span>`;

export function renderSiteFooter(): void {
  document.querySelectorAll<HTMLElement>("[data-site-footer]").forEach((footer) => {
    footer.innerHTML = FOOTER_HTML;
  });
}

renderSiteFooter();
