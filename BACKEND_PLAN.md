# Feira Boa backend, accounts, and alerts plan

**Status:** in progress — Phases 1–4 implemented in code; Phase 5 has had a local code review, while live verification and production secret setup remain.
**Goal:** let people save their preferences, follow products and stores, and receive relevant offer alerts while keeping browsing open to everyone and starting on free tiers.

## Recommended stack

- **Frontend:** keep the current static TypeScript site on Cloudflare Pages.
- **Accounts and data:** Supabase Auth and Postgres for sign-in, saved settings, and push subscriptions. The public Supabase client key may be used in the browser only with Row Level Security (RLS) policies enabled on every user-owned table.
- **Scheduled matching:** extend the existing GitHub Actions offer-monitor workflow to run daily. GitHub Free currently includes 2,000 Actions minutes per month for private repositories; check usage and current terms before relying on it.
- **Push delivery:** Web Push API with a service worker and VAPID keys. Keep the VAPID private key and Supabase service-role key in GitHub Actions Secrets, never in frontend code.

The current app has no server-side backend. The offers are static data in `offers.ts`; the existing workflow monitors source changes but does not extract or verify prices automatically.

## User experience

1. Anyone can browse without signing in.
2. Guests can save a shopping list and favorites in the browser.
3. Sign-in is optional and enables syncing preferences across devices. Use email and password for the initial release; add other sign-in providers only after a separate setup.
4. Users choose stores, product types, a light or dark theme, and a target price; they can pause alerts, remove individual rules, turn push off, and delete their account.
5. Ask for notification permission only after the user turns alerts on. Explain what alerts will be sent before the browser permission prompt.

## Data model

- `profiles`: `user_id` (Auth user ID), `created_at`, notification/time-zone preferences, and saved appearance in the `preferences` JSON object.
- `alert_rules`: `id`, `user_id`, optional store, product or product type, `target_price`, enabled/paused state, and creation time.
- `push_subscriptions`: `id`, `user_id`, endpoint, browser encryption keys, created/last-used timestamps.
- `notification_log`: a unique alert/offer key, `user_id`, sent time, and result. Use this to avoid repeat alerts and diagnose failed deliveries.

Add database migrations and RLS policies. A signed-in user may read, create, update, or delete only rows whose `user_id` matches their authenticated ID. The service-role key bypasses RLS, so it must be used only by the scheduled sender and kept secret.

## Build and rollout

### Phase 1 — Prepare one offer feed

- Give offer records stable IDs and keep the current product type, store, price, validity, and source URL fields.
- Generate a small JSON offer feed from the typed offer data during the build. The site and the scheduled matcher must read the same feed, so they cannot disagree about prices or dates.
- Keep the existing monitor’s rule: a changed source is marked for review; never send a price alert for an offer awaiting verification or outside its validity dates.

### Phase 2 — Add optional accounts and synced preferences

**Code status:** implemented on `develop`. All three Supabase migrations are applied to production; the account-deletion function still needs deployment, as described in the README.

- Create a Supabase project, Auth settings, database migrations, and RLS policies.
- Add sign-in, sign-out, and account deletion. Keep guest browsing and local favorites working if login is unavailable.
- Add the preferences page: favorite stores/products, target price, notification pause switch, and current push status.

### Phase 3 — Add browser push

**Code status:** service worker and user-initiated subscribe/unsubscribe are implemented. Subscriptions are stored per account and the scheduled sender is in place; production secrets and a live delivery check remain.

- Add a service worker and a user-initiated “Enable alerts” control.
- On approval, save the browser push subscription to `push_subscriptions`; on disable, unsubscribe and remove it from the database.
- Store the VAPID public key in frontend configuration and the private key only in GitHub Secrets. Treat push endpoints and encryption keys as private user data.

### Phase 4 — Match offers and send alerts

**Code status:** the daily matcher checks active dates, verified source state, target price, store/product-type criteria, user pause state, and sent-alert history. It removes expired subscriptions and reports aggregate outcomes. Production delivery requires the repository secrets and `SITE_URL` variable listed in the README.

- Extend the daily workflow to build/read the offer feed and query enabled alert rules.
- Match only verified, currently valid offers against the user’s chosen product/store and target price.
- Deduplicate sends with `notification_log`; remove subscriptions that the push service reports as expired. Keep messages short, with the store, item, price, validity, and a link back to the offer.
- Use a bounded daily schedule at first. Push delivery depends on user permission, device/browser support, and the browser’s push service; it is not guaranteed to be immediate.

### Phase 5 — Review and operate

**Progress:** The three migrations are applied to production. A live schema check confirms RLS is enabled on all four user-owned tables, all four policies are present, the theme constraint/default is installed, and existing profiles have a theme. Code review confirms deletion relies on auth-user cascades; the sender excludes expired or changed-source offers, deduplicates against `notification_log`, and removes subscriptions rejected as expired. The retry path now refreshes the notification log timestamp. Local build and tests pass. Live account-deletion, cross-user RLS isolation, unsubscribe, and push-delivery checks remain.

- Check RLS policies, account deletion, unsubscribe, duplicate suppression, expired offers, and changed-source handling before enabling alerts for users.
- Track Supabase usage, GitHub Actions minutes, failed sends, and stale subscriptions. Keep notifications opt-in and offer a visible way to pause them.
- Consider a Cloudflare Worker scheduler only if daily GitHub Actions are insufficient. Workers Free currently has daily request and CPU limits; check current limits and measured workload before moving jobs.

### Phase 6 — Admin access and operations view

**Status:** implemented as a read-only view; live verification of the allowlist and the aggregate RPC remains.

- `admin.html` / `admin-page.ts` show offer totals and validity per store, source verification status, and aggregate alert-delivery counters. Customer emails, saved preferences, push endpoints, encryption keys, and message payloads are never exposed.
- Authorization is a server-side allowlist: `public.admin_users` (migration `202610210001_admin_access.sql`) plus the `is_admin` RPC. There is no client-side flag and no editable user metadata path to admin rights. The `get_admin_alert_stats` RPC re-checks the allowlist before returning counts.
- The page is `noindex`, is not in the sitemap, and shows an authorization message without loading any data when the signed-in account is not allowlisted.
- Start read-only. If offer editing or source-review actions are added later, require server-side validation and an audit record identifying the admin, action, affected record, and time. Keep service-role credentials out of the browser.
- Before launch, test that ordinary users cannot load admin data or invoke admin actions, and that an admin can access only the intended operational view.

### Monitoring: Datadog and a free-first setup

**Code status:** the hourly public-site/data health check is implemented. Set the Actions variable `SITE_URL` before the scheduled job can run; operational usage and failed-run monitoring remain.

- Keep GitHub Actions as the first monitoring layer: retain the daily source checks and add a short hourly availability check for the live Pages site and its key data files. Fail clearly when the site or files cannot be fetched; use GitHub's workflow failure notifications. Keep this check fast and watch private-repository Actions minutes.
- Use Cloudflare's Pages deployment history and dashboard metrics for deploy and traffic visibility, and Supabase's dashboard for database/auth usage and errors. These are the services already hosting the app and backend.
- Datadog Free is an optional fit only if we later have a host to monitor: its free infrastructure plan is host-based (up to five hosts) and retains metrics for one day. The current static Pages + managed Supabase + scheduled Actions design has no app-owned server host, so Datadog Free does not provide a useful always-on website uptime check for this architecture.
- Do not count Datadog Synthetic Monitoring as permanently free. Treat Datadog's 14-day trial as a short evaluation only; do not enable paid checks or integrations while the budget is zero. Recheck plan terms before adopting it.
- Never send user email, shopping preferences, push endpoints, or subscription keys to monitoring logs. Use aggregate counts and redacted error messages.

References: [Datadog pricing](https://www.datadoghq.com/pricing/?LanguageId=1), [Datadog trial terms](https://www.datadoghq.com/free-datadog-trial/), [Datadog Synthetic Monitoring](https://docs.datadoghq.com/synthetics/).

## Free-tier limits and assumptions

Free tiers are useful for a small pilot but can change. As checked on 2026-10-16, Supabase lists 50,000 monthly active users and a 500 MB database on Free; inactive free projects can pause after one week. GitHub Free lists 2,000 Actions minutes per month for private repositories. Cloudflare Workers Free lists 100,000 requests per day, 10 ms CPU per invocation, and daily D1 read/write limits. Monitor these limits; do not promise permanently zero cost or uninterrupted service.

- [Supabase pricing](https://supabase.com/pricing)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [MDN Notifications API guidance](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)

## Is TypeScript the right language?

**Yes, for the app and alert-matching code.** The project already uses TypeScript, and the same `Offer`, `AlertRule`, and notification types can be shared across the frontend and scheduled matcher. This helps keep fields and filtering rules consistent as the backend grows. Keep the existing Python source-monitor script for now; rewriting a working small script would add work without improving user features. TypeScript is a practical fit here, not a requirement for every tool in the project.

## Automatic grocery offer ingestion

**Progress:** Official source inventory is recorded in [`docs/OFFER_SOURCE_INVENTORY.md`](docs/OFFER_SOURCE_INVENTORY.md). Big Bom's official flyer is the first adapter candidate because its offers page links a downloadable PDF; the adapter must discover the current campaign from the page rather than reuse a dated URL.

**Requirement:** Offers must load and publish without manual transcription or review. Use free tiers only; do not add paid OCR, AI, or scraping services.

### Design

- Keep Cloudflare Pages as the static host and GitHub Actions as the scheduler. Add one scheduled workflow per grocery shop so each source has independent parsing, cadence, failures, and logs.
- Give each shop a small adapter that fetches its official page, feed, PDF, or flyer and emits the common offer schema. Preserve store, branch, product, brand, package size, price, unit price when available, conditions, validity dates, source URL, and fetch time.
- Prefer structured product data or readable HTML. For flyer PDFs, extract embedded text first; use free, open-source OCR on the GitHub Actions runner only when needed. Do not send source documents to paid or third-party AI APIs.
- Write shop results to separate generated JSON files. Build the public offer feed from those files so the website and future alert matcher read the same records.
- Publish automatically only after deterministic checks pass: required fields exist, prices and dates parse, validity is current, product/price patterns are plausible, and duplicate records are removed. Checks do not require a person.
- If a fetch or extraction fails, retain the last known good result, record the failure, and exclude expired records from the public feed. Show last-updated time so stale data is visible. Never replace good data with an empty or malformed scrape.
- Commit generated data only when it changes. Cloudflare Pages deploys from that commit. Keep credentials out of the frontend and avoid secrets unless a shop source truly requires authentication.

### Rollout

1. Inventory each store's official source and classify it as structured feed, HTML page, text PDF, or image-only flyer. Confirm robots/terms and fetch behavior.
2. Build one adapter and scheduled workflow per shop, starting with the most structured source. Add a workflow-dispatch option for manual operational reruns; this does not introduce manual offer review.
3. Add text extraction and, if needed, open-source OCR for flyers. Normalize results into the common schema and run automated validation.
4. Deploy each shop's output automatically when valid. Keep a previous good snapshot and automatically omit data that has expired or cannot be refreshed safely.
5. Track run minutes, failures, source format changes, and data age. Adjust per-shop cadence to fit GitHub's free Actions allowance; run less often for weekly flyers and more often only where offers change frequently.

### Free-tier limits and accuracy trade-off

- Use GitHub Actions, Cloudflare Pages, and open-source extraction tools on ephemeral runners. Avoid a database, always-on server, paid OCR, and paid AI calls for this first version.
- Scheduled GitHub Actions are best-effort and may start late. Check current free-tier limits and measured minutes before adding schedules; no free tier guarantees permanent availability or unchanged quotas.
- Fully automatic flyer OCR can misread prices, package sizes, or dates. Automated rules reduce obvious errors but cannot guarantee perfect extraction. To honor the no-manual-review requirement, low-confidence or invalid results are skipped and the last known good, still-valid offers remain; expired offers are hidden. This favors missing a new offer over publishing a guessed price.

## Token-saving workflow preferences

- Use Caveman Ultra style for concise assistant responses.
- Caveman components and RTK v0.50.0 are installed. Configure RTK's global Codex hook after a refreshed shell can find `rtk`; until then, use RTK directly when available. RTK filters supported shell commands; it does not reduce built-in file reads or conversation text.
- Keep searches and file reads scoped to relevant files and line ranges. Prefer summaries and failures-only output for long-running commands.
- Avoid unrelated investigation and repeated context. Run only checks needed for the requested work.
