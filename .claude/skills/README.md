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
