---
name: offer-ingestion
description: >-
  Automate Feira Boa offer ingest when the user shares flyer images, PDF links,
  WhatsApp campaigns, or CI ingest failures. Transcribe into adapter JSON, run
  agent-ingest validation, and commit the workflow file set. Not for wiring
  Gemini/Google vision APIs into production CI.
---

# Feira Boa offer ingestion (agent workflow)

Use this skill when the operator wants to **refresh store offers** on Feira Boa. The scheduled GitHub Action (`monitor-offers.yml`) runs the same adapters; your job is to **update source data** (transcriptions, PDF URLs) and verify before they push.

## Source routing

| Store id | Adapter | How offers enter the repo | When the agent must act |
|----------|---------|---------------------------|-------------------------|
| `paguemenos` | `paguemenos.mjs` | Live VTEX API | Rare — API auto-updates; only on adapter/API changes |
| `bigbom` | `bigbom.mjs` | PDF text extraction | New flyer URL in page or `DEFAULT_FLYER_URL` in adapter when November PDF rotates |
| `sempre` | `semprevale.mjs` | `data/sempre-campaigns.json` | Ingest **throws** when discovered PDF URL ≠ `flyerUrl` in JSON |
| `corso` | `corso.mjs` | Auto: `jornal-frente` / `jornal-verso` JPG + hash; cache in `data/corso-campaigns.json` | Re-run ingest after hash/validity change; set `GEMINI_API_KEY` in CI for reliable vision OCR fallback |
| `fortemix` | `fortemix.mjs` | **Manual** `data/fortemix-campaigns.json` | New WhatsApp / app festival flyer — user attaches images (only store kept manual for now) |
| `spasso` | `spasso.mjs` | Image flyers on official page | Still **no auto transcription** in repo — retain `flyerImages` + optional manual JSON later |
| `spani` | `spani.mjs` | Live promos API | Usually automatic |

## Transcription rules (image / PDF flyers)

1. **Read the official source** (user images, PDF, or store URL) — never invent prices.
2. **Edit the campaign JSON** (not `state/*.json` by hand):
   - Forte Mix: `scripts/adapters/data/fortemix-campaigns.json` — bump `campaignId`, set `from`/`to`, `offers[]` with `{ name, brand, detail, cat, price, oldPrice, note? }`.
   - Sempre Vale: `scripts/adapters/data/sempre-campaigns.json` — update `flyerUrl` to match discovery error URL.
   - Corso: do **not** hand-edit unless fixing a bad automated cache — adapter writes `corso-campaigns.json` after successful extraction.
3. **Product names**: brand stays inside `name` after ingest (`mergeBrandIntoName` / feed build). Avoid flyer junk in `name` — validity banners and “Pague/Leve” codes belong in `note` when the adapter supports it.
4. **Taxonomy**: use realistic `cat` strings; `classifyProduct` maps to site sectors.
5. Do **not** add Gemini/OpenAI vision calls to adapters or CI unless the operator explicitly asks for that architecture change (`BACKEND_PLAN.md` default is no paid API in the scheduled ingest).

## Run pipeline (after JSON / adapter edits)

```bash
node scripts/agent-ingest.mjs --store <id>   # one store
node scripts/agent-ingest.mjs                # all stores
```

That runs `ingest-offers` (which rebuilds `offers.json`), then store-targeted tests and `tests/offer-feed.test.mjs`.

Extra checks when touching presentation rules:

```bash
node --test tests/offer-presentation-guard.test.mjs
npm run typecheck
```

Skip `npm run ingest:offers` without adapter changes (see `AGENT.md`).

## Commit set (matches CI bot)

When shipping to `main` / `develop` for production feed:

- `state/`
- `offers.json`
- `snapshot-manifest.json`
- `source-status.js`
- `.offer-monitor-state.json` (if monitor ran)
- Adapter/data files you changed under `scripts/adapters/`

Do **not** commit `build-info.json` (gitignored; Pages builds it).

## Merge conflicts on `offers.json` / `state/`

Prefer **regenerate** over manual merge:

```bash
git checkout --ours -- offers.json snapshot-manifest.json state/*.json   # or theirs, then:
node scripts/ingest-offers.mjs
```

Resolve adapter/data conflicts by hand, then re-ingest.

## Forte Mix / WhatsApp checklist

1. User provides one or two flyer images (Festival Felitá, Felitá brand, app-exclusive note).
2. Replace `fortemix-campaigns.json` content; new `campaignId` (e.g. `festival-felita-YYYY-MM-DD`).
3. `node scripts/agent-ingest.mjs --store fortemix`
4. `node --test tests/fortemix-adapter.test.mjs`
5. Commit adapter JSON + generated feed artifacts if the operator asked to push.

## What “automated” means here

- **GitHub Actions**: scheduled ingest + monitor on `main`.
- **Antigravity / Cursor agent**: this skill + `agent-ingest.mjs` for human-in-the-loop transcription and validation.
- Not the same as embedding Google Gemini API keys in the repository.
