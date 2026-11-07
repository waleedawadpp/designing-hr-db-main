# Superpowers (manual install)

This directory vendors the [superpowers](https://github.com/obra/superpowers)
skills library by Jesse Vincent (obra), installed manually because the
`/plugin` marketplace installer is not available in the Claude Code web /
remote environment.

- **Upstream:** https://github.com/obra/superpowers
- **Version:** 5.1.0
- **Vendored from commit:** `6fd4507659784c351abbd2bc264c7162cfd386dc`
- **License:** MIT — see `SUPERPOWERS-LICENSE` in this directory.

## What was installed

- `.claude/skills/*` — all 14 superpowers skills (each a `SKILL.md` plus
  supporting files). These are auto-discovered by Claude Code's `Skill` tool.
- `.claude/hooks/superpowers-session-start.sh` — a SessionStart hook adapted
  from the upstream plugin's `hooks/session-start`. It injects the
  `using-superpowers` skill content at the start of each session. It reads
  from this project's `.claude/skills` directory instead of a plugin root.
- `.claude/settings.json` — registers the SessionStart hook.

## Updating

To refresh from upstream:

```sh
git clone --depth 1 https://github.com/obra/superpowers.git /tmp/superpowers
cp -R /tmp/superpowers/skills/. .claude/skills/
```

Then re-copy the LICENSE and update the version/commit references above.

## Note vs. the real plugin

The official `/plugin install superpowers@claude-plugins-official` performs a
*user-level* install available across all your projects. This manual install
is *project-scoped* and committed to the repo, so it only applies here.

---

# Additional tools (manual install, 2026-11-07)

Installed project-scoped for the same reason as above (no `/plugin` installer
in the remote environment). Licenses are in `.claude/licenses/`.

| Upstream | Commit | What was installed |
|---|---|---|
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | `301b02b` | 25 skills in `.claude/skills/`, 4 subagents in `.claude/agents/`, 9 slash commands in `.claude/commands/` (`/spec`, `/plan`, `/build`, `/test`, `/review`, `/code-simplify`, `/ship`, `/constraints`, `/webperf`). Its `test-driven-development` skill is renamed **`agent-skills-tdd`** so it does not clash with superpowers' TDD skill. Its SessionStart hook is not wired (upstream says Claude Code doesn't need it). |
| [upstash/context7](https://github.com/upstash/context7) | `078c0c7` | Skills `context7-mcp`, `context7-cli`, `find-docs`; MCP server `context7` in `/.mcp.json` (`https://mcp.context7.com/mcp`). |
| [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | `16218bf` | `graphify install --project`: skill `graphify` (`/graphify`), `.claude/CLAUDE.md`, PreToolUse + SessionStart hooks in `.claude/settings.json`. The hooks are guarded with `command -v graphify` so they are no-ops when the CLI isn't installed. CLI: `uv tool install graphifyy`. |
| [21st-dev/magic-mcp](https://github.com/21st-dev/magic-mcp) | `6b5299e` | Skill `21st-ui`; MCP server `21st` in `/.mcp.json`. Needs env var `API_KEY_21ST` (get one at https://21st.dev/magic/console). |
| [usestrix/strix](https://github.com/usestrix/strix) | `0601550` | 9 Strix skills (pentest, API/web/OWASP testing, CI scanning, fixing findings). CLI: `uv tool install strix-agent`; needs Docker + `STRIX_LLM` / `LLM_API_KEY` to run scans. Only scan systems you own or are authorized to test. |

The CLIs (`graphify`, `strix`) are not stored in the repo; reinstall them per
machine/container with the `uv tool install` commands above.
