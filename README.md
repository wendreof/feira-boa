# Feira Boa

Local supermarket offers for São João da Boa Vista.

## Current prototype

- Search offers by product or brand.
- Filter results by store or category.
- Show the current price, previous price when printed, offer conditions, store, branch, and validity dates.
- Use product illustrations in the cards instead of embedding a flyer as the main experience.
- Link every offer back to its source flyer.
- Hide offers outside their printed validity dates.

The current data file contains a transcription of both pages of the Sempre Vale Durval Nicolau flyer (October 15–18, 2026), all 28 items in Big Bom's São João da Boa Vista flyer (October 13–15, 2026), and 10 offers shown on the official Supermercados Pague Menos page for its São João da Boa Vista store (consulted October 15, 2026). Pague Menos prices are online-only and may differ in the physical store; this limitation is shown on each offer. The site automatically hides offers outside their listed validity dates. A free GitHub Actions workflow now checks the official offer URLs daily, compares their contents, and publishes a visible alert if a source changes. It does not invent or automatically transcribe prices: changed flyers still need their offer details verified before replacing the old entries.

## Run locally

Open `index.html` in a browser. The prototype uses plain HTML, CSS, and JavaScript and has no package installation step.

## Scheduled source monitoring and production

The workflow in `.github/workflows/monitor-offers.yml` runs daily at 09:17 São Paulo time and can also be started manually from the GitHub Actions tab. It fetches the official flyer URLs already listed in `offers.js`, saves their fingerprints in `.offer-monitor-state.json`, and publishes the site through GitHub Pages when the fingerprints or alerts change. If a source changes, a visible notice stays on the site until its offers are verified and the corresponding `needs_review` flag is cleared. The workflow never guesses prices. GitHub says scheduled runs may be delayed during high load, so this is a daily check rather than an exact-time guarantee.

To publish: push the repository to GitHub, enable GitHub Pages with **GitHub Actions** as the deployment source, then run **Monitor official offer sources** once from the Actions tab. The workflow needs repository Actions write permission to save source fingerprints and alerts, plus Pages deployment permission to publish. The initial version monitors known flyer links; discovering new campaigns from store pages and safely extracting prices are follow-up automation steps.

## Data source

- Official offers page: https://www.semprevale.com.br/ofertas.php
- Instagram: https://instagram.com/semprevalesupermercados
- Facebook: https://facebook.com/semprevalesupermercados
- São João da Boa Vista, Durval Nicolau flyer: https://www.semprevale.com.br/downloads/ofertas/12c6dae5-141f-4b0c-8068-67f752874a71-campanha-575-crop-baixa%283%29.pdf
- Big Bom São João flyer: https://bigbom.com.br/wp-content/uploads/2026/10/Big-Ofertas.pdf
- Supermercados Pague Menos official offers for São João da Boa Vista: https://www.superpaguemenos.com.br/jornal-de-ofertas/
