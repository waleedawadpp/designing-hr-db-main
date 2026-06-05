# Installing Superpowers (official, user-level)

[Superpowers](https://github.com/obra/superpowers) is a skills library for
Claude Code (TDD, systematic debugging, planning, code review, and other
proven workflows). For a **permanent install that applies to all your
projects**, use the official plugin marketplace from your local Claude Code
CLI or desktop app.

> The web / remote (cloud) environment does not have the `/plugin` command, and
> its filesystem is ephemeral — so a global install must be done from your own
> machine. This repo also vendors a project-scoped copy under `.claude/skills/`
> (see `.claude/skills/README.md`), which only applies to this project.

## Option A — Official Anthropic marketplace (recommended)

In Claude Code (CLI or desktop app), run:

```text
/plugin install superpowers@claude-plugins-official
```

## Option B — Superpowers marketplace

Provides Superpowers plus related plugins.

```text
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

After installing, restart your Claude Code session (or `/clear`). The
`using-superpowers` skill loads at session start and the rest are available
via the `Skill` tool.

## Verifying

- Run `/plugin` and confirm **superpowers** is listed and enabled.
- Start a new session — you should see the "You have superpowers" context, and
  skills like `brainstorming`, `test-driven-development`,
  `systematic-debugging`, `writing-plans`, etc. become available.

## Other tools

| Tool            | Command |
| --------------- | ------- |
| Codex CLI       | `/plugins` → search `superpowers` → Install |
| Factory Droid   | `droid plugin marketplace add https://github.com/obra/superpowers` then `droid plugin install superpowers@superpowers` |
| Gemini CLI      | `gemini extensions install https://github.com/obra/superpowers` |
| GitHub Copilot  | `copilot plugin marketplace add obra/superpowers-marketplace` then `copilot plugin install superpowers@superpowers-marketplace` |
| Cursor          | `/add-plugin superpowers` |
| OpenCode        | Follow `https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md` |

## Updating

Plugins update through the marketplace. Re-run the install command or use
`/plugin` to update to the latest version.

---

Upstream: <https://github.com/obra/superpowers> · License: MIT
