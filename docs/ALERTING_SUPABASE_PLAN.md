# Alerting on Supabase: Edge Functions + email, then pg_cron

Scope: two independent but stackable options.

- **Option 1:** add an email alert channel delivered by a Supabase Edge Function through Resend or Postmark.
- **Option 2:** move the alert schedule from GitHub Actions to Supabase with pg_cron + pg_net, invoking the same Edge Function.

Recommendation: ship Option 1 first, keep the existing GitHub Actions cron as the trigger, then do Option 2 as a trigger swap plus a push-delivery port. The retry path for each option stays intact until the next one is proven.

## Current baseline

- `scripts/send-price-alerts.mjs` reads `offers.json` and `.offer-monitor-state.json` from the repo, matches `alert_rules` against verified offers, sends Web Push with `web-push`, and records `notification_log`.
- `.github/workflows/send-price-alerts.yml` runs it daily at 12:31 UTC and opens an issue on failure.
- `.github/workflows/monitor-offers.yml` runs ingest at 12:17 UTC and commits `state/`, `offers.json`, `source-status.js`, `.offer-monitor-state.json`.
- `notification_log` has a unique `(user_id, offer_id)`, so it cannot represent two channels for the same offer yet.
- `profiles` has `notifications_paused` and a JSON `preferences`, but no email consent or unsubscribe state.
- `supabase/functions/delete-account` is the only existing function (Deno, `npm:@supabase/supabase-js@2.118.0`).
- Node is 24 in CI and locally, so TypeScript can be imported directly for shared matcher code.

## Target architecture

```
monitor-offers.yml (ingest, stays in GitHub)
  -> uploads offers.json + source state to Storage (bucket alert-data)

Option 1 trigger (temporary): send-price-alerts.yml -> POST send-alerts (channel=email)
Option 2 trigger (final):     pg_cron -> pg_net -> POST send-alerts (channels=push,email)

send-alerts Edge Function
  -> reads feed snapshot + source state from Storage
  -> matches enabled alert_rules (shared matcher)
  -> push channel (Option 2) and/or email digest channel (Option 1)
  -> Resend/Postmark for email, VAPID for push
  -> writes notification_log per (user, offer, channel) and one alert_runs row
```

Why the function does the matching: it avoids a second matcher, makes the GitHub trigger replaceable by pg_cron without a rewrite, and keeps the feed/provider keys server-side. Option 1 therefore delivers email end to end but leaves push in the Node script until Option 2.

## Shared foundation (needed by both options)

### 1. Email consent schema

`supabase/migrations/202610220001_email_alert_preferences.sql`

```sql
alter table public.profiles
  add column if not exists email_alerts_enabled boolean not null default false,
  add column if not exists email_consent_at timestamptz,
  add column if not exists email_unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_email_unsubscribe_token_idx
  on public.profiles (email_unsubscribe_token);
```

Also add a trigger on `auth.users` email updates that resets `email_alerts_enabled = false` and `email_consent_at = null`; a new address must opt in again.

### 2. Per-channel delivery log

`supabase/migrations/202610220002_notification_log_channels.sql`

```sql
alter table public.notification_log
  add column if not exists channel text not null default 'push'
    check (channel in ('push', 'email')),
  add column if not exists provider_message_id text,
  add column if not exists batch_id uuid;

alter table public.notification_log
  drop constraint if exists notification_log_user_id_offer_id_key;

alter table public.notification_log
  add constraint notification_log_user_offer_channel_key
  unique (user_id, offer_id, channel);
```

Existing rows become `push`. All dedupe queries in both senders must filter by channel.

### 3. Feed snapshot in Supabase Storage

- Private bucket `alert-data`, objects `offers.json` and `source-state.json`.
- New `scripts/upload-alert-data.mjs` uploads both files with the service-role key.
- Add a step to `monitor-offers.yml` after "Save updated offers and source status", so the snapshot always matches the committed feed.
- `send-alerts` reads the objects with the auto-injected service-role client and keeps the current freshness guards: `MAX_FEED_AGE_MS` on `feed.updatedAt` and per-source `last_success_at`, plus the "verified active offers == 0" hard failure.
- Do not serve `.offer-monitor-state.json` from the public site; Storage avoids dotfile/public-path coupling.

### 4. Shared matcher

- Move `scripts/offer-matcher.mjs` to `supabase/functions/_shared/offer-matcher.ts` (pure functions only).
- Import it from the Node script as `../supabase/functions/_shared/offer-matcher.ts` (Node 24 type stripping).
- If the `.ts` import fights `tsc`, fall back to keeping the `.mjs` and adding a parity test that imports both implementations and compares results over fixtures. Do not let the two copies drift silently.
- `saoPauloDate()` must stay timezone-explicit; pg_cron runs in UTC and Brazil currently has no DST.

### 5. Alert run ledger

`supabase/migrations/202610220003_alert_runs.sql`

```sql
create table if not exists public.alert_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'ok', 'error', 'skipped')),
  mode text not null check (mode in ('live', 'dry_run')),
  trigger text not null check (trigger in ('github', 'cron', 'manual')),
  feed_updated_at timestamptz,
  active_offers int,
  verified_offers int,
  users_matched int,
  push_sent int,
  push_failed int,
  email_sent int,
  email_failed int,
  error_code text,
  details jsonb
);

alter table public.alert_runs enable row level security;
revoke all on public.alert_runs from anon, authenticated;
```

Add `public.get_alert_run_health()` as a security-definer RPC gated by `public.is_admin()` and render the last runs on the admin page. This is what turns "green run with zero emails" into a visible state.

## Option 1: Edge Functions + Resend/Postmark

### A1. Function shape

`supabase/functions/send-alerts/index.ts`

- `verify_jwt = false` in `supabase/config.toml`; require `x-alert-secret` and compare in constant time against `ALERT_CRON_SECRET`. Reject anything else with 401 before touching the DB.
- Body: `{ "channels": ["email"], "mode": "live" | "dry_run" }`. Default `mode` comes from `ALERTS_MODE` so the function can be deployed dark.
- Steps: insert `alert_runs` (`running`) -> load feed snapshot -> match rules -> build per-user digests -> send -> update run.
- Provider adapter in `email.ts`: `sendEmailBatch(messages)` returns provider ids/errors. Resend and Postmark implementations behind one interface, selected by `EMAIL_PROVIDER`.
- Secrets: `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`, `ALERT_FROM_EMAIL`, `ALERT_REPLY_TO`, `SITE_URL`, `ALERT_CRON_SECRET`, `OPS_EMAIL`, `ALERTS_MODE`. `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

Email lookup: `auth.admin.getUserById` per matched user, cached in memory for the run. Skip users with `email_alerts_enabled = false`, `notifications_paused = true`, or `email_confirmed_at` null. Do not copy addresses into `profiles` yet; revisit only if the user base makes admin API calls expensive.

### A2. Digest rules

- One digest per user per run, not one email per offer; this keeps volume inside provider limits and matches the daily cadence.
- Include up to 5 matched offers, then "e mais N ofertas" with a link to the account page.
- Exclude offers already present in `notification_log` with `channel = 'email' and result = 'sent'`.
- Log every included offer as `channel = 'email'`, `result = 'sent' | 'failed'`, with `provider_message_id` and a shared `batch_id`.
- A failed digest marks its offers `failed` with a safe `error_code` only (`email_429`, `email_5xx`, `email_invalid_address`); never store provider error bodies.
- Respect `profiles.timezone` later; ship one fixed 09:31 America/Sao_Paulo run first.

### A3. Templates and deliverability

`digest.ts` renders subject, HTML, and plain text in pt-BR. Subject example: `Feira Boa: 3 ofertas para voce hoje`. Each item: store, product, formatted BRL price, validity, link to `index.html?offer=<id>`. Inline CSS only, no tracking pixels, absolute logo URL.

- Verify the sending domain (SPF, DKIM, DMARC) before enabling live sends.
- From `Feira Boa <alertas@<domain>>`, reply-to a monitored address.
- Set `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers on every message.
- Start by sending to an internal test account only, then to opted-in users; low daily volume protects domain reputation.

### A4. Unsubscribe function

`supabase/functions/unsubscribe/index.ts`, `verify_jwt = false`.

- `GET ?token=<uuid>` renders a minimal confirmation page; `POST` with the one-click body performs the unsubscribe immediately (required for Gmail/Yahoo bulk senders).
- Look up the profile by `email_unsubscribe_token` with the service role, set `email_alerts_enabled = false`, keep push untouched, return 200 for unknown tokens without revealing validity.
- Add an "Descadastrar alertas por e-mail" link in the digest footer and on the account page.

### A5. Account UI

- `account.html`: new "Alertas por e-mail" block with a checkbox, consent copy (what is sent, how often, how to stop), the confirmed address, and an "e-mail nao confirmado" state.
- `account-page.ts` + `account.ts`: `setEmailAlerts(userId, enabled)` writes `email_alerts_enabled` and `email_consent_at`; disable the control when the address is unconfirmed.
- Update `database.types.ts` (`profiles` row/insert/update) and any profile types.

### A6. Trigger before Option 2

Add a second job to `.github/workflows/send-price-alerts.yml` (or a sibling `send-alert-emails.yml`) that runs after ingest has uploaded the snapshot:

```
curl -sS -X POST "$SUPABASE_URL/functions/v1/send-alerts" \
  -H "x-alert-secret: $ALERT_CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{"channels":["email"],"mode":"live"}'
```

Keep it independent of the push job so an email failure does not suppress push, and vice versa. Provision `ALERT_CRON_SECRET` as a GitHub secret for this phase and as a function secret.

### A7. Acceptance criteria

- Opted-in, confirmed user receives exactly one digest per day with correct prices and working offer links.
- No email for paused accounts, unconfirmed addresses, opted-out profiles, or offers already logged as sent.
- Unsubscribe link and one-click POST both stop the next run; unknown/reused tokens are safe.
- `mode=dry_run` sends nothing and records accurate counts in `alert_runs`.
- Provider 429/timeout produces a `failed` log with a safe code and a retry on the next run.
- No secret or raw provider error appears in client code or logs.

## Option 2: pg_cron / scheduled functions

Option 2 keeps the same function and adds push plus a Supabase-native schedule. It is a cutover, not a parallel sender; only one trigger may be live at a time.

### B1. Push delivery in Deno (spike first)

Current push uses `web-push` in Node. Before committing to Option 2, prove push from an Edge Function:

1. Spike `jsr:@negrel/webpush` (Deno-native VAPID + encryption) and `npm:web-push@3.6.7` (Node compat) in a throwaway function.
2. Send a test notification to a Chrome, Firefox, and Safari subscription using the existing VAPID keys.
3. Pick the working library; keep `web-push` payload semantics (`title`, `body`, `url`, `tag`) unchanged.
4. If neither works reliably, keep push in GitHub Actions and let pg_cron own email only as an interim; do not cut over push.

Keep the existing behavior: per-offer push, prune subscriptions on 404/410, digest email unchanged.

### B2. Feed snapshot and secrets

- Function secrets: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` (public key is already client-side), `VAPID_SUBJECT`, plus the Option 1 email secrets.
- Add `ALERT_CRON_SECRET` to Vault so pg_cron can read it without committing it:

```sql
select vault.create_secret('<random-32-bytes>', 'alert_cron_secret');
```

### B3. Cron trigger

`supabase/migrations/202610220004_alert_cron.sql` creates the trigger function but leaves scheduling to an explicit, documented step so environments can opt in:

```sql
create or replace function public.trigger_price_alerts()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-alert-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'alert_cron_secret')
    ),
    body := jsonb_build_object('channels', jsonb_build_array('push', 'email'), 'mode', 'live', 'trigger', 'cron'),
    timeout_milliseconds := 120000
  );
$$;

revoke all on function public.trigger_price_alerts() from public, anon, authenticated;
```

Prerequisites: enable `pg_cron` and `pg_net` for the project (Dashboard > Database > Extensions, or the Supabase Cron UI). Schedule in UTC, matching the current time:

```sql
select cron.schedule('feira-boa-price-alerts', '31 12 * * *', $$select public.trigger_price_alerts()$$);
```

`cron.schedule` is idempotent by job name. `net.http_post` is asynchronous; the function's own `alert_runs` row is the source of truth for send results, while `net._http_response` / `cron.job_run_details` confirm delivery of the HTTP call.

### B4. Function limits and resilience

- Verify the current wall-clock and CPU limits for the project's plan; finish within them.
- Batch DB reads and email sends (provider batch endpoints cap around 100 messages per request).
- Retry 429/5xx with capped exponential backoff and a per-run deadline; checkpoint counts in `alert_runs.details`.
- If the run approaches the deadline, stop cleanly, mark `status = 'ok'` with `details.partial = true`, and let the next run pick up unsent offers via `notification_log`.
- Cap digests per run only if volume demands it; the current daily model should fit.

### B5. Cutover and rollback

1. Deploy `send-alerts` with `ALERTS_MODE=dry_run`; invoke manually; compare matched users and offer coverage against the GitHub run for 2-3 days.
2. Run one live push test against a single opted-in test account; confirm subscription pruning.
3. Schedule cron, remove the `email` job from GitHub, and remove `schedule:` from `send-price-alerts.yml`; keep `workflow_dispatch` as the manual fallback.
4. Watch `alert_runs`, `cron.job_run_details`, and provider dashboards for 3 consecutive days.
5. After a clean week, delete the Node push sender and its cron workflow, or keep the workflow pinned as an emergency fallback.

Rollback: `select cron.unschedule('feira-boa-price-alerts');`, set `ALERTS_MODE=dry_run`, and re-enable the GitHub `schedule:` block. Do not leave both triggers live; the per-channel `notification_log` prevents duplicates but would still double the provider calls.

### B6. Acceptance criteria

- Cron fires at 09:31 America/Sao_Paulo (12:31 UTC); `alert_runs` shows one `cron` row with accurate counts.
- Push coverage and payloads match the Node sender for 3 consecutive days.
- Missing/invalid cron secret returns 401 and sends nothing.
- Stale feed or zero verified offers produces `status = 'error'`, `error_code` set, no sends, and one ops email for the day.
- Expired push subscriptions are still pruned; email unsubscribe still works.
- GitHub schedule is disabled; manual dispatch still invokes the fallback.
- A run that sends zero emails while matching users is surfaced as a warning, not a silent success.

## Sequencing and effort

| Step | Work | Rough effort |
| --- | --- | --- |
| 1 | Schema migrations, `alert_runs`, Storage bucket, upload step | 0.5-1 day |
| 2 | Shared matcher + function skeleton + provider adapter | 1 day |
| 3 | Digest templates, opt-in UI, unsubscribe | 1-1.5 days |
| 4 | Option 1 dry-run, tests, live email | 1 day |
| 5 | Push-in-Deno spike | 0.5-1 day |
| 6 | Full pipeline in function + alert run health UI | 1-1.5 days |
| 7 | Cron setup, shadow comparison, cutover | 1 day |

## Risks and mitigations

- **Deno push incompatibility:** spike before committing to Option 2; fall back to GitHub push + cron email.
- **Deliverability:** verified domain, confirmed addresses only, plain low-volume content, one-click unsubscribe. Never import addresses.
- **Duplicate sends:** one live trigger, `mode` flag, per-channel log, and a cutover checklist.
- **Silent zero-send:** `alert_runs.status` + `error_code` + daily ops summary email; admin health card.
- **Feed/snapshot drift:** upload snapshot only from the same workflow that commits the feed; keep freshness guards.
- **Timeout at scale:** batching, deadline checks, partial-run checkpoint; verify plan limits before launch.
- **Consent/privacy:** explicit checkbox, consent timestamp, unsubscribe, and a privacy-policy line; no open/click tracking.

## Decisions needed before implementation

1. Resend or Postmark? (recommend Resend for simpler batch API and free tier; verify current limits.)
2. Daily digest or instant per-offer email? (recommend daily digest; push stays per-offer.)
3. Single opt-in with a confirmed address, or double opt-in? (recommend single opt-in plus confirmation.)
4. Sending domain and from/reply-to addresses.
5. Keep push payload/behavior exactly as today? (recommend yes.)
