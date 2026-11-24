# Agent instructions

Canonical project instructions: [`AGENT.md`](AGENT.md). Read that file.

## Superpowers

Use the official [Superpowers](https://github.com/obra/superpowers) plugin for process skills (`using-superpowers`, `brainstorming`, `test-driven-development`, `systematic-debugging`, and the rest). Cursor install: `/add-plugin superpowers`. Routing: `.cursor/rules/superpowers.mdc`.

Do not vendor those skills into `.agents/skills`. That tree is **ai-memory** plus `offer-ingestion`.

## Agent skills (Matt Pocock)

Matt Pocock engineering skills are installed **globally** (`~/.agents/skills/`). Per-repo wiring:

### Issue tracker

GitHub Issues on `wendreof/feira-boa` via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` and `docs/adr/` when created via `/grill-with-docs`. See `docs/agents/domain.md`.

**Coexistence:** Superpowers stays the default **process** stack here (see above). Use Matt skills for `/grill-with-docs`, `/to-spec`, `/triage`, `/code-review`, etc. Run `/setup-matt-pocock-skills` again only to change tracker or labels.
