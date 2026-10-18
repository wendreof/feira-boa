# Feira Boa

Local supermarket offers for São João da Boa Vista.

## Current prototype

- Search offers by product or brand.
- Filter results by store, department, and product type.
- Set a minimum and maximum price, then sort by price or discount.
- Show the current price, previous price when printed, offer conditions, store, branch, and validity dates.
- Use product illustrations in the cards instead of embedding a flyer as the main experience.
- Link every offer back to its source flyer.
- Hide offers outside their printed validity dates.
- Switch between light and dark themes; signed-in users sync the choice with their account.

The current data file contains a transcription of both pages of the Sempre Vale Durval Nicolau flyer (October 15–18, 2026), all 28 items in Big Bom's São João da Boa Vista flyer (October 13–15, 2026), and 12 offers shown on the official Supermercados Pague Menos page for its São João da Boa Vista store (consulted October 15, 2026). Pague Menos prices are online-only and may differ in the physical store; this limitation is shown on each offer. The site automatically hides offers outside their listed validity dates. A free GitHub Actions workflow now checks the official offer URLs daily, compares their contents, and publishes a visible alert if a source changes. It does not invent or automatically transcribe prices: changed flyers still need their offer details verified before replacing the old entries.

## Run locally

The app uses TypeScript for offer data and browser interactions. Run `npm ci` and `npm run build` to compile the TypeScript and generate `offers.json` plus ignored `build-info.json`. The site footer shows the semantic version, commit, build time, and whether local changes were present. The offers feed contains stable offer IDs and the timestamp of the latest offer-data update; update `offersUpdatedAt` in `offers.ts` whenever the curated offers change. The feed is the shared source for the website and scheduled matching jobs. The compiled JavaScript and generated feed are committed so static hosting can serve the site from the repository root.

## Supabase accounts

Email accounts are optional and use the dedicated `login.html` page. Guest favorites stay in the current browser; signed-in favorites sync through the `profiles` table. The browser uses the Supabase publishable key in `supabase-config.ts`, which is public by design. Row Level Security limits every user-owned row to its owner. Never put a database password or service-role key in frontend files.

The first three migrations below were applied to the production Supabase project on 2026-10-18. Run every migration in order for a new environment before enabling account sync, suggestions, and offer votes:

1. Run `supabase/migrations/202610180001_profiles_and_alerts.sql`, `supabase/migrations/202610180002_favorite_product_types.sql`, `supabase/migrations/202610180003_theme_preference.sql`, `supabase/migrations/202610180004_suggestions.sql`, `supabase/migrations/202610180005_offer_reactions.sql`, and `supabase/migrations/202610180006_offer_reaction_permissions.sql` in the project SQL Editor.
2. Enable email sign-in in Auth. Set the Auth site URL and allowed redirect URLs to the deployed site (and local development URL if needed).
3. Deploy `supabase/functions/delete-account` with `supabase functions deploy delete-account --project-ref muiuvmhzzbqflxznpnez` and keep `SUPABASE_SERVICE_ROLE_KEY` in the function's server-side secrets. The delete button calls this function after an explicit confirmation.

The app remains browsable without an account. Guest theme choices are saved in the current browser; signed-in theme choices sync through `profiles.preferences`. Until the migrations and function are deployed, account sync and account deletion will report a setup error; local favorites continue to work.

The account page saves favorite stores/product types, theme, price alert rules, pause state, and optional browser push subscriptions. Push permission is requested only after the user chooses to enable it and confirms the alert contents. `service-worker.js` displays incoming alerts and opens the linked offer. The VAPID public key is safe to include in `supabase-config.ts`; the private key is kept only in the ignored local `supabase/functions/.env` during development. Move the private key to GitHub Actions Secrets before enabling the production sender. Subscriptions can be created now, but alerts are not sent until Phase 4 is deployed.

The daily workflow in `.github/workflows/send-price-alerts.yml` runs `scripts/send-price-alerts.mjs`. Before enabling it, add the repository Actions secrets `SUPABASE_SERVICE_ROLE_KEY` and `VAPID_PRIVATE_KEY`, and set the Actions variable `SITE_URL` to the deployed HTTPS site URL. `SITE_URL` is also used as the VAPID subject. The action reads the shared offer feed and monitor state; offers with unknown or changed source status are excluded. Run it manually only after these settings and all SQL migrations are in place.

## Scheduled source monitoring and production

The workflow in `.github/workflows/monitor-offers.yml` runs daily at 09:17 São Paulo time and can also be started manually from the GitHub Actions tab. It fetches the official flyer URLs listed in `offers.ts`, saves their fingerprints in `.offer-monitor-state.json`, and commits a visible alert when a source changes. If a source changes, the notice stays on the site until its offers are verified and the corresponding `needs_review` flag is cleared. The workflow never guesses prices. GitHub says scheduled runs may be delayed during high load, so this is a daily check rather than an exact-time guarantee.

Because the source repository is private, GitHub Pages on the free plan cannot host the public site. Cloudflare Pages builds with `npm run build` and publishes the `dist` directory. Cloudflare redeploys on pushes, including the monitor's changed-source alert commit. The initial monitor checks known flyer links; discovering new campaigns from store pages and safely extracting prices are follow-up automation steps.

## Data source

- Official offers page: https://www.semprevale.com.br/ofertas.php
- Instagram: https://instagram.com/semprevalesupermercados
- Facebook: https://facebook.com/semprevalesupermercados
- São João da Boa Vista, Durval Nicolau flyer: https://www.semprevale.com.br/downloads/ofertas/12c6dae5-141f-4b0c-8068-67f752874a71-campanha-575-crop-baixa%283%29.pdf
- Big Bom São João flyer: https://bigbom.com.br/wp-content/uploads/2026/10/Big-Ofertas.pdf
- Supermercados Pague Menos official offers for São João da Boa Vista: https://www.superpaguemenos.com.br/jornal-de-ofertas/
