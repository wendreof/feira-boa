# Offer source inventory

Inventory checked on 2026-10-18. Source formats can change; adapters must rediscover the current source from the official landing page rather than depend on a dated flyer URL.

| Store | Official entry point | Observed source format | Automation outlook |
| --- | --- | --- | --- |
| Sempre Vale | [Offers page](https://www.semprevale.com.br/ofertas.php) | HTML page with a store selector; the page's readable content does not expose offer rows. The site also publishes official PDFs under `/downloads/ofertas/`. | Candidate for an adapter after inspecting the selector's backing data or current PDF links. Scope the store to São João da Boa Vista / Durval Nicolau. |
| Big Bom | [Offers page](https://bigbom.com.br/ofertas/) | WordPress page; its readable content says offers are coming soon. The page snapshot's iframe points to a dated PDF that is no longer fetchable from the indexed result, while indexed PDFs from 2026 are already expired. | Do not start an auto-publishing adapter until the live page exposes a current campaign URL. A dated PDF discovered from a stale page must be rejected, never treated as current. |
| Pague Menos | [Official offer page](https://www.superpaguemenos.com.br/jornal-de-ofertas/) | The page could not be fetched during this check. Search results also show the retailer's offer content on its MallMais storefront, which is a separate offer platform. | Inspect the official page in a browser and identify its feed/API and store selection before automating. Do not treat search snippets or third-party pages as the source of truth. |
| Spasso Sabores | [São João page](https://spassosabores.com.br/ofertas-sao-joao/) | WordPress page with offer section headings and image content; no product/price rows were exposed in the readable page. | Likely image flyer/banner. Identify image URLs and dimensions; use local open-source OCR only if text is not embedded or accessible. |
| Corso | [Folheto frente](https://corso.com.br/jornalfrente.php) | Image flyer (`jornal-frente.jpg` / `jornal-verso.jpg`) with cache-bust `hash`. | Automated: discover hash, OCR (native Tesseract on Actions), optional `GEMINI_API_KEY` vision JSON, cache in `corso-campaigns.json`. |

## Adapter order

1. Recheck Big Bom's live offers page for an active campaign URL. Its visible/indexed source data is currently insufficient for safe auto-publication.
2. Investigate Sempre Vale's offer selector and PDF listing. Prefer a machine-readable response if the selector uses one; otherwise parse official PDF text.
3. Investigate the Pague Menos official page and its location-specific offer data. Keep the scope on Loja 33 in São João da Boa Vista.
4. Investigate Spasso's São João flyer assets. Add OCR only after confirming the source is image-only and the runner can install/use a free local OCR tool.

## Safe publication requirements

- Each adapter writes to its own generated snapshot and records `fetchedAt`, `sourceUrl`, campaign validity, and extraction status.
- Validate the store/branch, product name, price, validity, and source link before accepting any result. Skip uncertain records and retain the previous still-valid snapshot on fetch or parse errors.
- Do not publish a new snapshot that is empty, expired, missing required data, or implausibly different from the previous result without an explicit deterministic rule.
- Keep source discovery and extraction separate from the public-feed build. The feed builder combines only validated, current store snapshots.

## References checked

- [Sempre Vale official offers page](https://www.semprevale.com.br/ofertas.php)
- [Big Bom official offers page](https://bigbom.com.br/ofertas/)
- [Pague Menos official offer page](https://www.superpaguemenos.com.br/jornal-de-ofertas/)
- [Spasso Sabores official São João offers page](https://spassosabores.com.br/ofertas-sao-joao/)
