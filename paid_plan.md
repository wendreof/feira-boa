# Feira Boa — paid plan (product + rollout)

**Status:** product spec only — not implemented in code yet.  
**Goal:** keep browsing and basic alerts usable for everyone; monetize capacity, ad-free experience, and WhatsApp delivery.

## Tiers

### Free

- Browse offers, guest list/favorites, optional account sync (unchanged).
- **1 price alert** per account (not 20).
- **Notification channels:** Telegram and browser push (VAPID) — no charge for delivery; same alert rules drive all channels.
- **Ads:** when introduced, show discrete ads on free tier only (slots TBD in layout).

### Plus (paid)

- **Up to 20 price alerts** (same cap as today’s global limit, or raise later with fair use).
- **No ads.**
- **WhatsApp** as an optional notification channel (Plus-only).
- Telegram and push remain available for Plus users.

## What stays free on purpose

- Opening the site and reading offers.
- Telegram + VAPID push as channels (only the **number of alert rules** is limited on free).
- Do not paywall “receive any notification” on free — limit **rules**, not channels.

## WhatsApp (Plus)

- Treat as paid because Meta WhatsApp Business API bills per conversation/template and requires Business verification, approved templates, and explicit opt-in.
- Model after Telegram: link table (e.g. `whatsapp_links`), webhook for opt-in, sender branch in the price-alert job, separate `notification_log.channel = 'whatsapp'`.
- Ship **after** billing and `profiles.plan` are live.

## Ads (free only)

- No ad placements exist in the repo today; “sem anúncios” is a Plus promise for when ads ship.
- Implement as layout slots gated by `plan !== 'plus'`; document in UI/marketing before turning ads on.

## Grandfathering

- Existing accounts may have more than one alert rule before the cap ships.
- Choose one policy before launch:
  - **Hard cap:** cannot create new rules until at or below 1; existing rules stay until user deletes, or
  - **Soft migration:** prompt to pick one active rule, disable extras after a deadline.
- Record the chosen policy in release notes when implementing.

## Billing (when implementing)

1. **Database:** extend `profiles` with `plan` (`free` | `plus`), optional `plan_expires_at`, `stripe_customer_id` (or provider id), optional `billing_events` audit table.
2. **Enforcement:** server-side only — Postgres trigger on `alert_rules` insert reads plan limit (1 vs 20); client uses shared helper from `src/shared/alert-rules.mjs` for UX (must match DB).
3. **Checkout:** Stripe Checkout (BRL) + Customer Portal for cancel; webhook via Supabase Edge Function or Cloudflare Worker updates `plan` — never set `plan` from the browser.
4. **UI:** upgrade CTA on `alertas.html` at `1 de 1`; Plus badge on account; hide ad containers when `plus`.

## Rollout order

1. Migration + plan column; everyone `free`; wire **1 vs 20** limits (DB + UI).
2. Stripe (or chosen provider) + webhook; manual `plus` for testers first.
3. Ad slots on free tier (if/when needed for revenue).
4. WhatsApp channel + Meta setup last.

## Related docs

- `BACKEND_PLAN.md` — stack and alert architecture.
- `README.md` — Telegram, VAPID, GitHub sender secrets.
- Current caps: `supabase/migrations/202610200002_account_caps.sql`, `src/shared/alert-rules.mjs` (`MAX_ALERT_RULES = 20` today).

## Open decisions

- Plus price (BRL/month) and annual discount.
- Free alert count: strict **1** vs compromise **3**.
- Grandfathering policy for accounts with >1 rule at cutover.
- WhatsApp: utility-only templates vs marketing (compliance and cost).
