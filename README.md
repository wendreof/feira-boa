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

The catalog is assembled from official store sources by the adapters in `scripts/adapters/`. The current feed contains 1,288 offers across five monitored sources: Sempre Vale, Big Bom, Pague Menos, Spasso Sabores, and Supermercado Corso. Pague Menos offers come from the official online catalog collection and may differ in the physical store; this limitation is shown on each offer. The site automatically hides offers outside their listed validity dates. A scheduled GitHub Actions workflow checks the official offer URLs, stores source snapshots under `state/`, and publishes new prices immediately. Source review gates price alerts only; it does not hide the public offer feed.

## Run locally

The app uses TypeScript for offer data and browser interactions. Run `npm ci`, `npm run build`, and `npm test` before shipping. `offers.json` is built from the latest snapshots in `state/`; the curated data in `offers.ts` is a development fallback and is only published when no snapshot exists at all, so outdated prices never mix with fresh ones. `npm run ingest:offers` fetches official sources and updates snapshots; `npm run monitor:sources` records source health. The site footer shows the semantic version, commit, build time, and whether local changes were present. The compiled JavaScript and generated feed are committed so static hosting can serve the site from the repository root.

## Supabase accounts

Email accounts are optional and use the dedicated `login.html` page. Guest favorites stay in the current browser; signed-in favorites sync through the `profiles` table. The browser uses the Supabase publishable key in `supabase-config.ts`, which is public by design. Row Level Security limits every user-owned row to its owner. Never put a database password or service-role key in frontend files.

Run every migration in order for a new environment before enabling account sync, suggestions, and offer votes:

1. Run `supabase/migrations/202610180001_profiles_and_alerts.sql`, `202610180002_favorite_product_types.sql`, `202610180003_theme_preference.sql`, `202610180004_suggestions.sql`, `202610180005_offer_reactions.sql`, `202610180006_offer_reaction_permissions.sql`, `202610200001_suggestion_retention.sql`, `202610200002_account_caps.sql`, and `202610210001_admin_access.sql` in the project SQL Editor.
2. Enable email sign-in in Auth. Set the Auth site URL and allowed redirect URLs to the deployed site (and local development URL if needed).
3. Deploy `supabase/functions/delete-account` with `supabase functions deploy delete-account --project-ref muiuvmhzzbqflxznpnez` and keep `SUPABASE_SERVICE_ROLE_KEY` in the function's server-side secrets. The delete button calls this function after an explicit confirmation.

The app remains browsable without an account. Guest theme choices are saved in the current browser; signed-in theme choices sync through `profiles.preferences`. Until the migrations and function are deployed, account sync and account deletion will report a setup error; local favorites continue to work.

### Login with Google

`login.html` offers "Continuar com Google" next to the e-mail form. The button calls `supabase.auth.signInWithOAuth` with the Google provider and returns to `login.html?returnTo=…`; the saved destination is validated as a same-origin path before the redirect, and the session is completed by the Supabase client (`detectSessionInUrl`).

Enabling it is a Supabase console setup, not a code change:

1. In Google Cloud Console, create an OAuth 2.0 Web client and add the Supabase callback URL `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
2. In Supabase → Authentication → Sign In / Providers → Google, enable the provider and paste the Google client ID and client secret.
3. In Supabase → Authentication → URL Configuration, set the Site URL to the deployed site and add `https://feira-boa.pages.dev/login.html` (plus `http://localhost:4173/login.html` for local work) to the redirect allow list.
4. In Authentication → Providers, keep email/password enabled: Google sign-in creates the same account rows, and the `on_auth_user_created_profile` trigger creates the profile automatically.

If the provider is not enabled, the button reports that Google sign-in is unavailable and the e-mail form keeps working.

## Operations dashboard (admin)

`admin.html` is a read-only operations view for trusted maintainers: offer totals and validity per store, source verification status, and aggregate alert-delivery counters. It never shows emails, saved preferences, push endpoints, or notification payloads.

Access is granted by an explicit allowlist table, never by a client-side flag or editable user metadata:

```sql
-- grant access
insert into public.admin_users (user_id)
select id from auth.users where email = 'voce@exemplo.com';

-- revoke access
delete from public.admin_users where user_id = (
  select id from auth.users where email = 'voce@exemplo.com'
);
```

The page asks Supabase for the signed-in session and then calls the `is_admin` RPC; without an allowlisted account it shows an authorization message and loads no data. The aggregate counters come from the `get_admin_alert_stats` RPC, which re-checks the allowlist on the server. The page is `noindex` and is not part of the sitemap.

The account page saves favorite stores/product types, theme, price alert rules, and pause state. Push notifications are delivered by OneSignal: permission is requested only after the user enables alerts and confirms the contents, `pwa.js` initializes the OneSignal SDK (App ID in `pwa.js`), and `service-worker.js` loads the OneSignal worker instead of handling push itself.

The daily workflow in `.github/workflows/send-price-alerts.yml` runs `scripts/send-price-alerts.mjs`. Before enabling it, add the repository Actions secrets `SUPABASE_SERVICE_ROLE_KEY` and `ONESIGNAL_REST_API_KEY`, and set the Actions variable `SITE_URL` to the deployed HTTPS site URL. The sender resolves the OneSignal App ID from `pwa.js`. The action reads the shared offer feed and monitor state; offers with unknown or changed source status are excluded. Run it manually only after these settings and all SQL migrations are in place.

## Scheduled source monitoring and production

The workflow in `.github/workflows/monitor-offers.yml` runs daily at 07:07 and 18:07 São Paulo time and can also be started manually from the GitHub Actions tab. It runs the official-source adapters, saves offers in `state/`, and records source health in `.offer-monitor-state.json` and `source-status.js`. A changed or failed source is marked for review and can open a GitHub issue; reviewed prices publish immediately, while price alerts stay blocked until the source is reviewed. The workflow never guesses prices. GitHub says scheduled runs may be delayed during high load, so these are daily checks rather than exact-time guarantees.

Because the source repository is private, GitHub Pages on the free plan cannot host the public site. Cloudflare Pages builds with `npm run build` and publishes the repository root (`.`) directory. Cloudflare redeploys on pushes, including the monitor's changed-source alert commit. The monitor checks the known official source URLs; discovering unlinked campaigns and safely extracting those prices remain follow-up automation steps.

## Data source

- Sempre Vale official offers: https://www.semprevale.com.br/ofertas.php
- Sempre Vale Durval Nicolau campaign: https://www.semprevale.com.br/downloads/ofertas/af2914c3-feb6-42c1-928d-035c32f3b337-campanha-583-crop-baixa(3).pdf
- Big Bom São João flyer: https://bigbom.com.br/wp-content/uploads/2026/10/Big-Ofertas.pdf
- Supermercados Pague Menos official offers: https://www.superpaguemenos.com.br/ofertas?productclusterids=161
- Spasso Sabores São João offers: https://spassosabores.com.br/ofertas-sao-joao/
- Supermercado Corso flyer: https://corso.com.br/jornalfrente.php

## Social card

`social-card.png` (1200x630, used by the `og:image` and `twitter:image` meta tags) is generated by `npm run build:social-card`, which runs `node scripts/build-social-card.mjs`. The script renders an HTML document with the `favicon.svg` brand mark inlined and screenshots it with the locally installed Google Chrome (or Microsoft Edge) in headless mode, so no npm dependency is added and the build never depends on a browser. It asserts the produced PNG is exactly 1200x630 before writing it, and fails loudly when no browser is installed. The script is standalone on purpose: it is not part of `npm run build`, so CI does not need Chrome. The card uses a system font stack (`Segoe UI`, `Arial`, `sans-serif`) instead of the site's Manrope/DM Sans web fonts, because the generated PNG must not depend on a network fetch.
