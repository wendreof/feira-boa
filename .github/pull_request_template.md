## Summary

<!-- What changed, in one short paragraph or a few bullets. -->

## Motivation

<!-- Why this change is needed. Link an issue if one exists. -->

## Type

<!-- Mark one. -->

- [ ] **feat** — user-facing behavior or data presentation
- [ ] **fix** — bug or regression
- [ ] **ingest** — adapters, snapshots, `offers.json`, or ingest workflow
- [ ] **docs** — README, AGENT.md, comments only
- [ ] **ci** — GitHub Actions, Dependabot, checks

## Test plan

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run test:ui` (required if UI, layout, or Playwright scripts changed)
- [ ] Ingest: if `scripts/adapters/` or ingest workflows changed, confirm `offers.json` / `state/` updates are **intentional** (do not commit accidental feed churn from local `npm run ingest:offers` unless that is the goal)

## Screenshots

<!-- Optional. Before/after for visible UI changes. -->

## Deploy / secrets

Do not commit secrets. For Actions env vars, Cloudflare Pages, Supabase, OneSignal, and ingest keys, see [AGENT.md](../AGENT.md) (repo root).
