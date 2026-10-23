# AGENT.md

## Project: Feira Boa

Feira Boa is a static supermarket-offers site for São João da Boa Vista. The app shows flyer offers, filters, favorites, theme switching, and optional Supabase-backed account features without needing a server-rendered app.

### Core goals
- Surface local supermarket offers in a fast, searchable UI.
- Keep the data source transparent and reviewable.
- Let users save favorites and preferences per browser or signed-in account.
- Support scheduled source monitoring and price alerts without storing secrets in frontend code.

## Stack and architecture

### Frontend
- Plain static HTML/CSS/JS generated from TypeScript sources.
- TypeScript entry points: `app.ts`, `login-page.ts`, `account-page.ts`, `suggestions-page.ts`.
- Bundling is done with `esbuild` via `npm run build`.
- Tracked site artifacts are served from the repository root. `build-info.json` is generated and ignored by Git, so deployment must run `npm run build` before publishing.
- Cloudflare Pages uses build command `npm run build` and output directory `.`. After changing build or deployment settings, verify the deployed `/build-info.json` is JSON and run `npm run check:site` against the public `SITE_URL`.

### Data pipeline
- `offers.ts` is the curated fallback catalog.
- `scripts/adapters/*` fetch official sources; `npm run ingest:offers` writes snapshots in `state/`.
- Pague Menos uses the official VTEX catalog API for collection `161`, paginated 50 products at a time; it filters unavailable items, deduplicates normalized name/brand/detail groups, and keeps package details derived from product names.
- `scripts/build-offer-feed.mjs` prefers snapshots, applies brand/note presentation normalization plus legacy taxonomy, and generates `offers.json` plus build metadata.
- A full feed currently has about 1,288 offers; Pague Menos accounts for 1,015 of them, so preserve keyed card reuse and test large-feed rendering after data changes.
- Card presentation is name-first; `marca · detalhe` is secondary, and the store logo belongs to the source row.
- `assignIcon` in `scripts/adapters/common.mjs` picks the emoji by product name first and only then by product type; `scripts/build-offer-feed.mjs` refreshes the icon of every snapshot offer at build time, so icon rule changes apply without re-ingesting.
- The generated feed is the shared source for the website and the scheduled monitoring jobs.
- New prices publish immediately; `needs_review` gates alert eligibility only.

### Catalog taxonomy
- `catalog-taxonomy.mjs` is the display taxonomy: 14 sectors (Alimentos frescos, Mercearia, Bebidas alcoólicas, Bebidas, Congelados e refeições, Saudáveis e dietéticos, Limpeza, Higiene e beleza, Bebês e infantil, Pet shop, Casa e utilidades, Churrasco e festas, Vestuário e calçados, Outros) with their subcategories.
- The feed keeps the original adapter product types; `resolveCategory()` maps each offer to a sector/subcategory by type and by product-name keywords.
- The "Setor" filter lists the sectors in that order, "Tipo de produto" lists the subcategories, and "Recomendadas" sorts by sector then subcategory.
- The header chip row ("Explorar por categoria") is: Mais curtidos, Maiores descontos, Carnes, Bebidas and then the remaining sectors in a random order. "Mais curtidos" and "Maiores descontos" also filter (only offers with likes / only offers with a discount).
- Changing the taxonomy means editing `catalog-taxonomy.mjs` and its test, not the feed.

### Offer cards
- Card order is name, brand tag, detail, info line (`⭐ likes · category · store`), price with the discount badge next to it, reactions, note and source.
- The discount shows as a `-25%` badge next to the price; the old price is only in the badge tooltip/aria-label, never both.
- The ★ marks the three most liked active offers (reaction counts come from the database).

### Service worker
- The shell cache name includes the build commit, so every deploy invalidates the old cache.
- On localhost the service worker does not cache and unregisters itself, so local previews always show the current build.

### Auth and persistence
- Supabase handles optional account auth and account-scoped sync.
- The login page supports e-mail/password and Google OAuth (`signInWithGoogle` in `account.ts`); the Google provider itself must be enabled in the Supabase console, and the Google client ID/secret never live in the frontend.
- Favorites and reactions require a signed-in account; the login prompt opens from favorite/reaction controls and the Favoritos nav.
- Guest localStorage favorites are a one-time migration source merged into the account on first sign-in, not a signed-out UI feature.
- Signed-in data is stored in Supabase tables with RLS protection.
- `supabase-config.ts` contains only the public publishable key.
- Never place service-role or database secrets in browser code.

### Notifications and monitoring
- `service-worker.js` handles push notifications.
- Account push state is per device, while the backend flag is account-wide; copy must distinguish “Ativado neste dispositivo” from “Ativado em outro dispositivo.”
- `push-state.js` owns notification control state and actionable error copy.
- `scripts/send-price-alerts.mjs` sends alerts using VAPID credentials.
- GitHub Actions monitors offer-source changes and can alert when a source changes.
- Keep VAPID private keys and `SUPABASE_SERVICE_ROLE_KEY` in GitHub Actions secrets or local ignored env files, not in the repo.

## Important files

- `README.md` — project setup and operational notes
- `BACKEND_PLAN.md` — architecture notes, pricing, and deployment constraints
- `offers.ts` — curated fallback catalog
- `catalog-taxonomy.mjs` — sectors, subcategories, and highlight tabs used by filters and ordering
- `app.ts` — main UI behavior and client-side state
- `supabase-client.ts` — Supabase client setup
- `supabase-config.ts` — public Supabase settings
- `account.ts` — account, preferences, rules, and subscription logic
- `account-page.ts`, `account-alerts.html` — account UI, including device/account push states
- `push-state.js` — push UI state and failure-message mapping
- `theme.ts` — theme persistence
- `scripts/build-offer-feed.mjs` — feed generation
- `scripts/send-price-alerts.mjs` — notifications sender
- `scripts/check-site-health.mjs` — health validation
- `supabase/migrations/*` — database schema changes
- `supabase/functions/delete-account/index.ts` — secure account deletion function

## Working rules for this repo

### Always do this
- Prefer source edits in TypeScript files instead of editing generated `.js` bundles.
- Run the smallest relevant validation after a change.
- Keep the repo aligned with the static hosting build flow: `tsc` + feed generation + bundling.
- Preserve the public/private key split: public keys in frontend config, private keys in env/secrets only.
- Keep user-facing output brief, direct, and practical.

### Never do this
- Do not commit Supabase service-role keys or database secrets to frontend files.
- Do not hardcode private VAPID keys into the app or repo.
- Do not edit generated JavaScript files as the primary fix path.
- Do not add unrelated investigation or broad refactors when a targeted fix is enough.

## Local development commands

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run check:site
npm run send:price-alerts
```

## Safety and auth guidance

- Publishable Supabase keys are safe for the browser because they are designed for public use.
- Service-role keys and admin secrets must stay server-side.
- For account deletion, prefer the dedicated Supabase Edge Function and require explicit confirmation before deletion.
- Source monitoring and price alerts should never guess prices when a source is uncertain.

## Token-saving workflow preferences

This repo explicitly prefers a compact, low-noise agent style.

- Use Caveman Ultra style for assistant responses: short, direct, no fluff.
- Use RTK v0.50.0 when available and configured in the shell; if the global Codex hook is not available yet, use RTK directly when possible.
- Keep searches and file reads precise and limited to the files needed for the task.
- Prefer targeted reads and narrow line ranges over broad scans.
- Show summaries, not huge logs, for long-running commands.
- Avoid repeated context gathering and unrelated exploration.
- Treat the build/test/test-run loop as the source of truth for validation.

### Practical RTK/Caveman workflow
1. Define the exact task and the minimal file set.
2. Run one targeted search or symbol lookup.
3. Read only the exact file/sections needed.
4. Make the minimal fix.
5. Validate with the smallest relevant command.
6. Report only the outcome, the verification, and any follow-up risk.

## Response expectations for future agents

When working in this repo, keep the interaction crisp:
- State what you are checking.
- Fix the root cause.
- Validate with a narrow command.
- Summarize the result and any caveats.

Use the existing repo knowledge, not generic assumptions. The site is a static frontend with Supabase-backed user features, not a full backend app.
