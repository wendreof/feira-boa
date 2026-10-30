# Feira Boa Continuation Plan

Last updated: 2026-10-23 (OneSignal follow-ups + price-alert ops issue #22 resolved)
Repository: `C:\Users\wendreof\Documents\Codex\2026-10-15\id\feira-boa`

## Mobile-first pass (in progress, 2026-10-30)

Goal: every page must look right on phones (most users are mobile) without breaking desktop. Pages: `index`, `lojas`, `account`, `alerts`, `mensagens`, `suggestions`, `login`, `termos`, `admin`, `offline`.

### Done
- **Account name block squeezed to ~56px** (`/account` "Como gostaria de ser chamado?"). Cause: the `@media(max-width:450px){.avatar-block{grid-template-columns:56px ...}}` rule overrode `.display-name-block`. Fixed by scoping it to `.avatar-block:not(.display-name-block)` in `styles.css`.
- **Account page mobile polish** (`styles.css`, `@media(max-width:760px)` block after the 450px rule): wider card, stacked name input/button, 2-column avatar actions, full-width "Sair" / "Excluir conta" buttons.
- **Store cards squeezed on `/lojas`** (text column wrapped letter by letter). Cause: `.store-source` is a flex row, and the rating block (`.store-rating`, appended by `src/stores-ratings.ts`) became a third flex column. Fixed in `stores.css` with a `@media (max-width:760px)` grid: logo + text on row 1, "Ver folheto" button full width on row 2, rating full width on row 3. Desktop untouched.
- **Playwright MCP configured globally** in `~/.config/opencode/opencode.json` (not in the repo): `npx @playwright/mcp@latest --browser chrome`. Requires an opencode restart to load.

### Review pass (2026-10-30, Playwright MCP, 390x844 and 1280x900)
- Reviewed screenshots: `/lojas`, `/index`, `/login`, `/account` (signed in with the test account), `/alerts` (redirects to login when signed out, as expected).
- No page-level horizontal overflow on any of the 10 pages at either width.
- `/index` hero account panel: legacy `.account-panel>div ...` rules (written for an older layout) hid its title and forced a grey nowrap ellipsis on mobile. Scoped them with `:not(.account-panel-text)` in `styles.css`; title and description now read correctly.
- `.popular-items` category chips overflow the viewport by design: the row is an `overflow-x:auto` carousel. Not a bug; no change.
- Tap targets: login "Esqueci a senha", "Criar conta grátis", "Mostrar", and offline "Tentar novamente" were 14-25px tall. Added a `max-width:760px` block at the end of `styles.css` raising them to 44px.
- Kept as-is on purpose: header "Menu" (38px, compact header by design), theme toggle (40px), filter chips inside the horizontal scroller (33px), brand link.
- Not reviewed visually yet: `mensagens`, `suggestions`, `termos`, `admin`, `offline` (only overflow and tap-target checks ran).

### Next steps
1. Visually review `mensagens`, `suggestions`, `termos`, `admin`, and `offline` at 390x844.
2. Re-run the overflow check after the new `styles.css` block and confirm desktop 1280px is unchanged.
3. Decide whether to commit the mobile changes (`styles.css`, `stores.css`, `CONTINUE_PLAN.md`). Do not commit `.playwright-mcp/` screenshots.

## OneSignal follow-ups (resolved 2026-10-23)

Reproduced in browser console after the OneSignal migration (self-hosted SDK in `onesignal/`, init in `pwa.js`, worker via `importScripts` in `service-worker.js`):

1. **CSP blocked OneSignal sync script — FIXED**
   ```
   Loading the script 'https://api.onesignal.com/sync/510d37b8-17a0-41dd-a0b2-a8d5ca29f2fc/web?callback=__jp0'
   violates Content Security Policy: "script-src 'self'". Blocked.
   ```
   Fixed by adding `https://api.onesignal.com` to `script-src` in `_headers` (it is a JSONP-style script load; `connect-src` already covered it via `https://*.onesignal.com`). Verified end-to-end in headless Chrome against a local server that applies `_headers`: the sync request now loads and zero CSP violations appear. `check-site-health.mjs` with `REQUIRE_SECURITY_HEADERS=1` still passes.

2. **SW message-handler lint warning — investigated; inherent to vendor SDK**
   ```
   OneSignalSDKWorker.js:1 Event handler of 'message' event must be added on the
   initial evaluation of worker script.
   ```
   Isolated CDP test (headless Chrome, real worker registration) with the vendored SDK run both through `try { importScripts(...) } catch` and through a bare top-level `importScripts(...)` produced the warning in both cases. The cause is inside the vendor bundle: OneSignal registers its WorkerMessenger `message` listener inside `setTimeout(() => { workerMessenger._listen(); ... }, 0)` (deliberate, for test-mock setup — see OneSignal-Website-SDK `src/sw/serviceWorker/ServiceWorker.ts`). No restructuring of our import can remove it without patching minified vendor code.
   Functional impact is negligible: the SDK's top-level `message` handler (session upsert/deactivate), `push`, and `pushsubscriptionchange` listeners *are* registered during initial evaluation, so Chrome will still wake the worker for those events; the deferred WorkerMessenger handlers (`notification.display`, subscribe commands) only receive traffic that originates after the worker is already active, well after the `setTimeout(0)` has run. Decision: keep the resilient `try/catch` around `importScripts` (removing it would make a missing/offline SDK file break the entire worker and its caching) and treat the warning as a known cosmetic OneSignal v16 behavior.

Also verified: on localhost OneSignal init fails with `Can only be used on: https://feira-boa.pages.dev` (expected — OneSignal refuses localhost). End-to-end push verification still needs the production domain.

## Price-alert ops issue #22 (resolved 2026-10-23)

`[ops] Price alert job failed` (run 39976177475): the alert job threw `No verified active offers` because every currently-active offer came from a `needs_review` source — the gate working as designed. Investigation found three causes and two adapter bugs:

1. **Pague Menos was monitored through the wrong bytes (root cause).** The monitor hashed the storefront HTML page, but that page is a Next.js client-render shell with zero product data; its hash only changes when the store redeploys (`buildId`). It had been stuck at `needs_review:true` for 9 consecutive monitor runs while the real data (VTEX catalog API) was never watched. Fix (`scripts/monitor-sources.mjs` + `probePagueMenosCatalog` in the adapter): sources whose monitored URL is a dynamic shell get a **structural probe** instead — the monitor now fetches the catalog API, records `catalog_total` and `week_window`, and drives review from the weekly Monday-Sunday campaign rotation, probe failures, and URL changes. Ordinary daily price/availability/membership churn no longer pauses alerts. `fetchWithRetry` gained an injectable `fetchImpl` for this; `tests/monitor-sources.test.mjs` covers the new behavior.
2. **Big Bom rotated campaigns and the parser broke on the new layout.** The new PDF spreads the grid over 4 pages and ends the highlights page with the validity line, so the old page-1-only extraction wiped all products and retained the expired snapshot. Fix (`scripts/adapters/bigbom.mjs`): process every page, prefer the legacy banner-strip only when it still leaves a priced grid, strip section headers (`DESTAQUES`/`COMBOS`/`OFERTAS`), treat `Nesta embalagem ... sai por` as a condition note, support `NN/NNg` weight ranges, and throw on unparseable dates instead of silently using a stale default. New campaign (23-25 Oct) now yields 79 offers.
3. **Corso rotated to a new image flyer.** The adapter is a manual transcription keyed to the page's `jornal-frente.jpg?hash=` timestamp; the hash advanced (new campaign published). Re-transcribed both flyer images (read via the image tool) into `scripts/adapters/corso.mjs`, now organized as three campaign sections with their own validity (front 23-24, "Promoção Imbatível" 23-29, main grid 23-26) — 121 offers, all active.
4. **Sempre Vale** legitimately rotated to campanha-576 (22-25); 74 offers parsed cleanly.
5. **Spasso** still serves image flyers pending transcription (0 offers); its flag stays set as a source-health signal and does not affect the alert gate.

Operational resolution: re-ingested all sources, re-ran the monitor, and reviewed Pague Menos, Sempre Vale, Big Bom, and Corso with `review-source.mjs`. The alert matcher now sees **1,284 active offers, all verified** — the gate no longer throws. The next scheduled alert run on `main` should succeed once these changes are pushed.

## Objective

Finish the Feira Boa hardening work while preserving product behavior:

- Newly ingested/scraped prices publish immediately.
- Only alert eligibility remains source-review-gated (`needs_review`).
- Do not add a staging gate around `offers.json`.
- Keep the site usable on desktop and mobile.

## Non-Negotiable Decisions

- Cloudflare Pages command: `npm run build`.
- Cloudflare Pages output directory: `.` (repository root), never `dist/`.
- Workflow failures open/update a GitHub issue instead of relying only on email.
- Source/feed freshness window: 24 hours.
- PWA PNG icons and the 1200x630 social card are approved.
- Suggestion abuse protection: DB constraints/retention + client cooldown + honeypot. Turnstile remains deferred.
- Local `python` is unavailable. Git is available at `C:\Users\wendreof\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd\git.exe`, but is not on `PATH`.

## Current Data State

- `offers.json`: 1,284 offers from 5 stores (Sempre Vale 74, Big Bom 79, Pague Menos 1,010, Corso 121, Spasso 0); all 1,284 fall within their validity dates today and are source-verified for alerts.
- Snapshot state (fetched `2026-10-23T18-19Z`, local re-ingest):
  - `state/sempre.json`: 74 offers; 22-25; campaign `...campanha-576`
  - `state/bigbom.json`: 79 offers; 23-25; multi-page PDF layout
  - `state/paguemenos.json`: 1,010 offers; 19-25; catalog collection `161` (1,039 API products)
  - `state/corso.json`: 121 offers; three windows 23-24 / 23-26 / 23-29; image flyer hash `1792720156`
  - `state/spasso.json`: 0 offers; `status: image_flyer_pending_transcription`
- Source review status: Big Bom, Pague Menos, Sempre Vale, and Corso `needs_review:false` (reviewed 2026-10-23); **Spasso remains `needs_review:true`** pending image transcription — it has 0 offers and does not gate alerts.
- Pague Menos is monitored structurally (`week_window` + `catalog_total` on the state entry); its storefront-shell hash no longer drives review.
- No generated offer has the legacy `Geral` department; current feed IDs also satisfy the new reaction ID shape.
- `offers.ts` fallback contains refreshed campaign metadata; it publishes only when no snapshot exists at all.
- `lojas.html` also lists Forte Mix and other local stores; they are flagged as "Sem ofertas coletadas" because they are not monitored offer sources.

## Completed

### App, UX, and Accessibility

- DOM-safe card rendering, safe URLs, keyed reuse, focus restoration.
- Debounced filters, lazy account/reaction imports, loading/error/retry states.
- Share, favorite, and reaction controls wired.
- Signed-out reaction clicks open an accessible login prompt with `Entrar ou criar conta`; cancel restores focus to the reaction button, and the login return path preserves the current page/offer.
- Mobile overflow fixes, one-column layout at 420px, reduced-motion CSS.
- `navigation.js` mobile drawer:
  - Focus moves into the drawer.
  - Tab/Shift+Tab stay inside.
  - Escape closes it.
  - Background `<main>`, topbar, and bottom nav become `inert`.
  - Focus returns to `#menu-toggle`.
  - Signed-in Supabase session updates account links to `account.html` / "Minha conta".
- Offers nav state works at both `/` and `/index.html`.
- Offer cards now lead with the product name, show `marca · detalhe` on the second line, and place the compact store logo in the source row.
- Build-time presentation normalization extracts brands across all five sources, removes duplicate brand text, canonicalizes known brand casing, and normalizes note whitespace, limits, and promotional casing.
- Brand/note regression coverage was added for Sempre, Big Bom, Corso, and descriptive product names such as `CREME AVELÃ NUTELLA`.

### Security, PWA, and Deployment

- Strict CSP with no inline styles/handlers. JSON-LD remains compatible.
- `_headers` includes CSP, nosniff, frame denial, referrer policy, permissions policy, COOP, and CORP.
- CSP `script-src` allows `self` plus `https://api.onesignal.com` for the OneSignal SDK's JSONP sync script (2026-10-23).
- OneSignal v16 SDK is self-hosted in `onesignal/` (page SDK + worker) so ad blockers cannot break push; init is in `pwa.js`, worker loaded via `importScripts` in `service-worker.js` (kept inside try/catch for offline resilience).
- The OneSignal worker's cosmetic `message`-listener warning is vendor-inherent (SDK defers its WorkerMessenger listener via `setTimeout(0)`); confirmed with an isolated CDP test — both try/catch and bare `importScripts` warn identically.
- Service worker cache is `feira-boa-shell-v7`; `/app.js` is precached.
- Removed the `?v=` query from `index.html`'s app script so precache matching works.
- Offline fallback verified for unknown routes.
- Social metadata, canonical URLs, sitemap, PWA icons, manifest, and social card are in place.
- Root build verifies 39 required artifacts and rejects inline event handlers.

### Data Pipeline

- Five adapters use shared `fetchWithRetry()` for timeout + transient retries.
- Pague Menos now uses the official offers collection (`productclusterids=161`) through the paginated VTEX catalog API instead of the obsolete flyer `data-json` parser.
- Pague Menos maps product names, prices, list prices, brands, categories, and package details; unavailable/zero-price products are skipped, and variants with identical normalized name/brand/detail keep the lowest price.
- Pague Menos validity uses a stable Monday-Sunday window, and API brand variants are canonicalized (`Pilão`, `Itambé`, `Café Pelé`, `Mãe Terra`, `YoPRO`, and others).
- Source snapshots live in `state/`; `offers.json` is generated from them.
- The `offers.ts` curated catalog is a development-only fallback (published only when no snapshot exists at all); its source URLs and validity windows were refreshed to the 2026-10-23 campaigns (2026-10-23).
- Unknown `Geral` offers are normalized through `classifyProduct()` / `assignIcon()` during build.
- Added mappings for eggs, Nutella/hazelnut cream, sandals, and "New Fort/Fervedor".
- Fixed overbroad Pet regex `/cat/` that matched "categoria".
- `AGENT.md` now documents the fallback -> adapters -> snapshots -> feed flow.
- `README.md` documents ingestion, deployment, migrations, and alert freshness.

### Account, Suggestions, and Supabase

- Suggestion honeypot + 60-second cooldown; stale cooldown text clears automatically.
- Push cleanup runs before sign-out and account deletion.
- Renewed push subscriptions replace the old endpoint.
- Account push UI now distinguishes `Ativado em outro dispositivo` from local activation, changes the action to `Ativar neste dispositivo`, and shows inline state/error feedback.
- Push failures are mapped to actionable messages; an unsaved subscription is unsubscribed to avoid orphaned browser state.
- New migrations created:
  - `202610200001_suggestion_retention.sql`: 180-day cleanup, `created_at` index.
  - `202610200002_account_caps.sql`: 20 alerts/user, 10 push subscriptions/user, reaction ID constraint, reaction lookup index.
- Push cap migration permits re-upserting an existing endpoint at the cap.

### Favorites now require an account (2026-10-22)

- Signed-out users can no longer toggle favorites, open the Favoritos nav links, or use `?view=favorites`; each path opens the accessible login prompt (`Entre para salvar favoritos`).
- The prompt dialog was generalized (`askForLogin`) with per-intent copy and an optional cancel callback; cancel restores focus and, for a direct `?view=favorites` visit, exits favorites mode and strips the URL param.
- Guest localStorage favorites are a one-time migration only: they are merged into the account on `connectAccount` and the local key is removed. They no longer hydrate the signed-out UI.
- The hero account panel is a single link to `login.html` (CTA is visual only); copy across `index.html`, `login.html`, and status messages now says favorites are saved on the account.
- `saveFavoriteChanges` no longer writes localStorage; the sync-failure message no longer claims device-local saving.

### Taxonomy and classifier fixes (2026-10-22)

- Added `Bebidas alcoólicas` as its own sector in `catalog-taxonomy.mjs` (14 sectors total); `AGENT.md` updated.
- Restored the Nutella/hazelnut-cream → `Doces e snacks` mapping lost in the `PRODUCT_TYPE_RULES` refactor.
- `Carnes suínas` is matched before `Carne bovina` so `Filé Mignon Suíno` classifies as pork.
- Condiment names (`ketchup`, `mostarda`, `maionese`) win over meat keywords, so `Ketchup … Bacon` stays `Mercearia`.
- Pague Menos store path `mercearia/cafe e achocolatados` maps to `Café`.
- Taxonomy tests updated for the new sector order and `bebidas_alcoolicas`/`Cervejas` mapping.

### CI and Dependencies

- Actions pinned to verified commit SHAs:
  - `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7`
  - `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7`
- `pull-request-checks.yml` builds before tests and disables persisted credentials.
- `check-site-health.yml` requires security headers.
- `monitor-offers.yml` uses an explicit token for its state commit.
- `.github/dependabot.yml` enables weekly npm + GitHub Actions updates.
- `check-site-health.mjs` verifies CSP directives and all major security headers.
- `npm audit`: 0 vulnerabilities.

## Verification Status

Latest checks passed (2026-10-23):

- `npm run typecheck`: passed.
- `npm run build`: passed; 39 root artifacts; 1,284 offers; 30 structured-data offers.
- `npm test`: 52/52 passed, including Pague Menos catalog mapping, stable weekly validity, package details, presentation normalization, taxonomy sector order, classifier regressions, push-state/error coverage, and the new monitor structural-probe suite.
- Local site health (`check-site-health.mjs` with `REQUIRE_SECURITY_HEADERS=1` against a local server that applies `_headers`): `status:ok`.
- CSP fix verified in headless Chrome (CDP): `https://api.onesignal.com/sync/...` JSONP loads, zero CSP violations. OneSignal init on localhost correctly refuses (`Can only be used on: https://feira-boa.pages.dev`).
- SW message-handler warning verified as vendor-inherent: isolated CDP worker test produced the warning for both try/catch and bare `importScripts` variants.
- Issue #22 resolution verified: alert matcher sees 1,284 active offers, all source-verified; the `No verified active offers` gate no longer throws. Four sources reviewed; Spasso remains flagged (0 offers, transcription pending).
- Signed-out favorites/reactions: like and favorite controls plus Favoritos nav open the login prompt; `?view=favorites` prompts and exits favorites mode on cancel.
- Pague Menos ingestion: 1,039 catalog products, 1,010 after availability filtering and normalized deduplication; watched structurally by the monitor.
- Chrome desktop app:
  - 1,240 active cards rendered in about one second; no duplicate IDs or console errors.
  - Pague Menos filter shows 1,015 cards and links to the official collection.
  - Search `pilao` returns 22 offers with canonical `Pilão` brand labels.
- Chrome mobile app:
  - 1,240 cards, no horizontal overflow; store filters remain horizontally scrollable.
- Signed-out like opens `Entre para avaliar`; primary action is focused, cancel closes and restores focus, and continue reaches `login.html` with the current `returnTo`.
- Source monitor checked 5 sources with 0 failures; Pague Menos was reviewed, while Spasso’s changed source remains flagged.
- Suggestions:
  - Cooldown disables submit and counts down correctly.
  - Expired cooldown clears status and re-enables submit.
  - Honeypot submission is accepted without network access, then resets.
- Offline:
  - Cache `feira-boa-shell-v7`, 230 cards offline.
  - Unknown route renders `offline.html`.
  - Only expected external resource failures were logged offline.
- Action tag SHAs verified against the GitHub API.

## Remaining Work

### External / Manual

1. Apply the two new Supabase migrations after checking production reaction rows:
   ```sql
   select offer_id
   from public.offer_reactions
   where offer_id !~ '^[a-z0-9][a-z0-9-]{2,199}$';
   ```
   - Verify 21st alert rejected, 11th subscription rejected, invalid reaction ID rejected.
   - Verify anonymous suggestion insert still works and anon cannot read suggestions.
2. Deploy through Cloudflare Pages with root output.
   - Confirm `build-info.json` commit matches deployment.
   - Set the `SITE_URL` Actions variable.
   - Run production `check-site-health.mjs` with security headers.
3. Configure required alert secrets only when ready: `SUPABASE_SERVICE_ROLE_KEY`, `ONESIGNAL_REST_API_KEY` (OneSignal replaces VAPID; App ID lives in `pwa.js`). Local CSP/init verification is done; OneSignal end-to-end must be confirmed on `https://feira-boa.pages.dev` (it refuses localhost).
4. ~~Review the sources stuck in `needsReview:true` so alert eligibility resumes.~~ **Done (2026-10-23):** Pague Menos, Sempre Vale, Big Bom, and Corso reviewed after their data was verified/re-ingested; only Spasso stays flagged pending image transcription (0 offers; does not gate alerts). See the issue #22 section above.

### Product Decisions

- ~~Decide whether to replace the stale `offers.ts` fallback metadata or guarantee a snapshot is always present.~~ **Done:** the curated catalog is now a development fallback only. The build publishes it only when no snapshot exists at all, so an outdated flyer can never mix with fresh prices. The Sempre Vale fallback metadata was refreshed to the current campaign for local work.
- Decide whether a large-feed strategy is needed later (incremental "load more" or virtualized cards); the current 1,284-card render is under one second in desktop Chrome.
- Confirm that Pague Menos online collection prices and the `Loja 33` branch label match the intended physical-store audience.
- Decide whether ESLint/Prettier are worth adding; no linter was added. Current gate is TypeScript + esbuild + Node tests.
- Optional: add `pg_cron` cleanup if Supabase enables it, instead of insert-triggered suggestion retention.
- Optional: add real push enable/disable and authenticated-account QA once Supabase test credentials exist.

### Operations dashboard

- `admin.html` + `admin-page.ts` implement the read-only Phase 6 view: catalog totals and validity per store, source verification status, and aggregate alert-delivery counters.
- Access is granted through the `public.admin_users` allowlist (migration `202610210001_admin_access.sql`) and checked server-side through the `is_admin` and `get_admin_alert_stats` RPCs. No user data is exposed.
- Still to verify live: grant an allowlist row, confirm a non-admin account is refused, and confirm the aggregate counters match the sender's own reports.

## Known Constraints and Risks

- Git is not on `PATH`; use the GitHub Desktop Git executable path for status/diffs/commits.
- No local `python`.
- Supabase migrations are not applied; no CLI/credentials are configured locally.
- No production domain is configured in the repository, so production health/deployment verification is pending.
- Spasso serves image flyers pending manual transcription (0 offers) and is the only source still under review; its flag is a source-health signal and does not gate alerts.
- Big Bom and Corso rely on manual/parsed flyer transcription: when their campaign artifacts change (PDF layout, image hash), the adapter or transcription must be updated in the same change window or the ingest retains the previous snapshot.
- Pague Menos is monitored structurally against the catalog API (weekly-window review); its storefront-shell bytes are intentionally not hashed.
- OneSignal SDK v16 emits a cosmetic `message`-listener warning from inside its own bundle (registered via `setTimeout(0)`); this is vendor-inherent and cannot be fixed without patching minified vendor code.
- Pague Menos offers come from the online catalog; store labels state that online prices may differ from the physical store.
- The feed is dominated by Pague Menos (1,010 of 1,284 offers), so future source-count and UI-performance changes should account for the larger catalog.
- Offline first load can log expected external logo/build-info failures; core feed rendering succeeds.
- Do not gate price publishing to solve alert review concerns.

## Key Files

### App and UI

- `app.ts`, `styles.css`, `index.html`, `lojas.html`, `stores-page.ts`
- `suggestions.html`, `suggestions-page.ts`, `navigation.js`
- `theme.css`, `theme-bootstrap.js`, `pwa.js`, `service-worker.js`, `offline.html`

### Account and Supabase

- `account.ts`, `account-page.ts`, `account-alerts.html`, `offer-reactions.ts`, `suggestions.ts`
- `push-state.js` — device/account notification state and user-facing error mapping
- `supabase/migrations/202610180001_profiles_and_alerts.sql`
- `supabase/migrations/202610180002_favorite_product_types.sql`
- `supabase/migrations/202610180003_theme_preference.sql`
- `supabase/migrations/202610180004_suggestions.sql`
- `supabase/migrations/202610180005_offer_reactions.sql`
- `supabase/migrations/202610180006_offer_reaction_permissions.sql`
- `supabase/migrations/202610200001_suggestion_retention.sql`
- `supabase/migrations/202610200002_account_caps.sql`

### Data and Monitoring

- `offers.ts`, `offers.json`, `source-status.js`, `.offer-monitor-state.json`
- `state/{bigbom,corso,paguemenos,sempre,spasso}.json`
- `scripts/ingest-offers.mjs`, `scripts/monitor-sources.mjs`
- `scripts/review-source.mjs`, `scripts/write-source-status.mjs`
- `scripts/offer-matcher.mjs`, `scripts/send-price-alerts.mjs`
- `scripts/adapters/{common,bigbom,corso,paguemenos,semprevale,spasso}.mjs`

### Build, Deployment, and Tests

- `package.json`, `package-lock.json`, `tsconfig.json`, `_headers`
- `README.md`, `AGENT.md`, `sitemap.xml`
- `scripts/build-offer-feed.mjs`, `scripts/build-structured-data.mjs`
- `scripts/check-site-health.mjs`, `scripts/verify-root-artifacts.mjs`
- `scripts/github-issue.mjs`
- `tests/{adapters,offer-feed,offer-matcher,push-state,status-toast,view-mode}.test.mjs`
- `.github/workflows/{pull-request-checks,check-site-health,monitor-offers,send-price-alerts}.yml`
- `.github/dependabot.yml`

## Verification Commands

```powershell
npm run typecheck
npm run build
npm test
npm run verify:artifacts
```

Local health check:

```powershell
$env:SITE_URL = "http://127.0.0.1:8788"
node scripts/check-site-health.mjs
```

Headless Chrome:

```text
C:\Program Files\Google\Chrome\Application\chrome.exe
```

Playwright/Puppeteer are not installed; QA used temporary CDP scripts outside the repository.

## Resume Checklist

- [x] Fix CSP `script-src` for `https://api.onesignal.com/sync/...` JSONP load — done 2026-10-23; verified in headless Chrome with zero CSP violations.
- [x] Investigate OneSignal worker `message` listener initial-evaluation warning — vendor-inherent (SDK registers the listener inside `setTimeout(0)`); isolated CDP test confirmed both try/catch and bare `importScripts` warn; keeping the resilient try/catch.
- [x] Re-run typecheck/build/tests — 52/52 passed; 39 root artifacts; 1,284 offers; local health check with security headers `status:ok`.
- [ ] Confirm no newer user instruction conflicts with this plan.
- [x] Review the sources stuck in `needsReview:true` so alert eligibility resumes — Pague Menos, Sempre Vale, Big Bom, and Corso reviewed 2026-10-23; only Spasso remains flagged (0 offers; does not gate alerts).
- [ ] Commit and push the issue #22 fixes to `main` (monitor structural probe, Big Bom parser, Corso transcription, reviewed state) so the scheduled alert run picks them up; then close issue #22 with a summary comment.
- [ ] Apply and validate the two Supabase migrations.
- [ ] Deploy to Cloudflare Pages with root output.
- [ ] Set `SITE_URL` and run production health check with security headers.
- [ ] Verify OneSignal end-to-end on production (`https://feira-boa.pages.dev`): init succeeds, Ativar notificações works, `ONESIGNAL_REST_API_KEY` secret confirmed, dry-run alert send passes.
- [ ] Optional authenticated push/account end-to-end QA.
