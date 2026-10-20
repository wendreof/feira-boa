# Feira Boa Continuation Plan

Last updated: 2026-10-20 (post card and notification QA)
Repository: `C:\Users\wendreof\Documents\Codex\2026-10-15\id\feira-boa`

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

- `offers.json`: 278 offers, 230 active, 5 sources.
- Last feed timestamp: `2026-10-20T02:27:00.565Z`.
- Snapshot validity:
  - `state/sempre.json`: 19-21; campaign `af2914...campanha-583`
  - `state/bigbom.json`: 19-22
  - `state/paguemenos.json`: 19-25
  - `state/spasso.json`: 19-24; 0 offers
  - `state/corso.json`: 16-22
- All five source statuses are reviewed with `needs_review:false`; last successes around `2026-10-20T02:44Z`.
- No generated offer has the legacy `Geral` department; current feed IDs also satisfy the new reaction ID shape.
- `offers.ts` fallback still contains the old Sempre Vale `12c6dae5...campanha-575` campaign and 15-18 dates. Snapshots override it, but it is stale.
- `lojas.html` also lists Forte Mix; it is not one of the five monitored flyer sources.

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
- Service worker cache is `feira-boa-shell-v7`; `/app.js` is precached.
- Removed the `?v=` query from `index.html`'s app script so precache matching works.
- Offline fallback verified for unknown routes.
- Social metadata, canonical URLs, sitemap, PWA icons, manifest, and social card are in place.
- Root build emits 34 required artifacts and rejects inline event handlers.

### Data Pipeline

- Five adapters use shared `fetchWithRetry()` for timeout + transient retries.
- Source snapshots live in `state/`; `offers.json` is generated from them.
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

Latest checks passed:

- `npm run typecheck`: passed.
- `npm run build`: passed; 34 root artifacts; 278 offers; no `Geral`.
- `npm test`: 25/25 passed, including presentation normalization and push-state/error coverage.
- Local site health (`check-site-health.mjs` with full headers): `status:ok`, 278 offers.
- Chrome 390px `lojas.html`:
  - No horizontal overflow.
  - Five freshness labels show 19/10/2026 in America/Sao_Paulo.
  - All six displayed logos loaded this run; fallback remains available.
  - 0 inline handlers; no console/CSP errors.
- Chrome 390px app:
  - 230 cards; feed status hidden after load; search works.
  - No horizontal overflow; card width 354px in list mode; drawer focus trap/Escape/focus restoration passed.
  - Product name, `marca · detalhe`, and source logo fit without clipping.
  - Signed-out like opens `Entre para avaliar`; primary action is focused, cancel closes and restores focus, and continue reaches `login.html` with the current `returnTo`.
- Chrome 1280px app:
  - 230 cards, 3-column grid at 313px card width, no overflow.
  - Product name leads each card; `marca · detalhe` is the second line; source logo appears before the branch name.
  - Search "leite" returned 11 offers with announcement.
  - Desktop-to-mobile resize stayed at 390px with one column.
  - No console/runtime errors were reported by the final CDP pass.
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
3. Configure required alert secrets only when ready: `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`.

### Product Decisions

- Decide whether to replace the stale `offers.ts` Sempre fallback metadata or guarantee a snapshot is always present.
- Decide whether ESLint/Prettier are worth adding; no linter was added. Current gate is TypeScript + esbuild + Node tests.
- Optional: add `pg_cron` cleanup if Supabase enables it, instead of insert-triggered suggestion retention.
- Optional: add real push enable/disable and authenticated-account QA once Supabase test credentials exist.

## Known Constraints and Risks

- Git is not on `PATH`; use the GitHub Desktop Git executable path for status/diffs/commits.
- No local `python`.
- Supabase migrations are not applied; no CLI/credentials are configured locally.
- No production domain is configured in the repository, so production health/deployment verification is pending.
- Spasso currently has 0 offers by source behavior; this should remain visible as a source-health condition.
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

- [ ] Confirm no newer user instruction conflicts with this plan.
- [ ] Re-run typecheck/build/tests.
- [ ] Spot-check card title/brand/detail/source rendering and account push inline feedback.
- [ ] Apply and validate the two Supabase migrations.
- [ ] Deploy to Cloudflare Pages with root output.
- [ ] Set `SITE_URL` and run production health check with security headers.
- [ ] Decide on stale fallback metadata and lint/format policy.
- [ ] Optional authenticated push/account end-to-end QA.
