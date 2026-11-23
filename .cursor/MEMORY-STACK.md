# Cross-session memory (Feira Boa)

**Your Cursor user profile** uses [claude-mem](https://github.com/thedotmack/claude-mem): MCP in `~/.cursor/mcp.json`, hooks in `~/.cursor/hooks.json`, global rule `claude-mem-efficiency.mdc`.

**This repo** still documents [ai-memory](https://github.com/akitaonrails/ai-memory) until you choose to migrate project wiring:

| Artifact | Role |
|----------|------|
| `.ai-memory.toml` | ai-memory project scope |
| `.cursor/rules/ai-memory-default.mdc` | Agent routing to ai-memory MCP/skills |
| `.agents/skills/ai-memory-*` | Managed skills (do not delete casually) |
| `AGENT.md` (`<!-- ai-memory:start -->` block) | Install routing text |

## If you fully drop ai-memory for this repo

1. Export or copy anything you need from ai-memory wiki first (`http://127.0.0.1:49374/` while the server runs).
2. Run `ai-memory uninstall --apply --yes` (removes skills + autostart; optional `--purge-data`).
3. Replace or retire `.cursor/rules/ai-memory-default.mdc`, `.ai-memory.toml`, and the `AGENT.md` ai-memory block; point agents at claude-mem `search` / `timeline` / `get_observations` with project filter.
4. Update `.cursor/rules/superpowers.mdc` so it no longer names ai-memory as memory of record.

Until then, agents may see **both** global claude-mem rules and repo ai-memory rules — prefer **claude-mem** for new recall unless you are explicitly using ai-memory wiki pages.