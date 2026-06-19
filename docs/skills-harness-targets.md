# Skill Installation Targets

Last checked: 2026-06-19.

Sources used:
- local Antigravity config layout under `C:\Users\johno\.gemini\config`
- installed Pi docs: Pi loads both `~/.pi/agent/skills/` and `~/.agents/skills/`
- public `skills@1.5.12` support matrix for non-Google harnesses

## Key rule

`SKILL.md` is the portable unit. `~/.agents/skills` is **not** a universal global location.

Pi does load `~/.agents/skills`, so Takomi keeps using that path for Pi/shared Agent Skills. Other harnesses use their own global/user-level paths.

## Takomi harness sync targets

Takomi's global store remains `~/.takomi/skills` and `~/.takomi/workflows`. `takomi setup` / `takomi sync` materialize Takomi-managed resources from that store into each detected harness target below while preserving manual/modified files through ownership manifests.

Supported materialization modes:

- `symlink`: create per-skill/per-workflow directory symlinks or junctions from harness folders back to `~/.takomi` so there is one canonical copy.
- `auto`: try symlinks/junctions first, then fall back to copies if the filesystem or OS blocks links.
- `copy`: copy independent files into each harness folder.

Set `TAKOMI_HARNESS_SYNC_MODE=symlink|auto|copy` to override the manifest's saved sync mode for one `takomi sync`/auto-sync run.

| Harness | Takomi id | Global skills target | Global workflows target |
|---|---:|---|---|
| Antigravity | `antigravity` | `~/.gemini/config/skills/` | `~/.gemini/config/global_workflows/` |
| Claude Code | `claude_code` | `~/.claude/skills/` | - |
| Codex | `codex` | `~/.codex/skills/` | - |
| Cursor | `cursor` | `~/.cursor/skills/` | - |
| Kilo Code | `kilocode` | `~/.kilocode/skills/` | `~/.kilocode/workflows/` |
| Pi / shared Agent Skills | `pi` | `~/.agents/skills/` | - |
| Windsurf | `windsurf` | `~/.codeium/windsurf/skills/` | `~/.codeium/windsurf/global_workflows/` |

## Deprecated / intentionally not synced

- Gemini CLI is not a Takomi sync target anymore.
- Old Antigravity paths are not used anymore:
  - `~/.gemini/antigravity/skills/`
  - `~/.gemini/antigravity/global_workflows/`
  - `~/.gemini/antigravity-cli/skills/`

## Common project-local targets from skills.sh

| Harness family | Project skills target |
|---|---|
| Antigravity, Codex, Cursor and several universal agents | `.agents/skills/` |
| Claude Code | `.claude/skills/` |
| Kilo Code | `.kilocode/skills/` |
| Windsurf | `.windsurf/skills/` |

## Recheck command

```bash
npx -y skills@latest --help
npm pack skills@latest
```

Then inspect the package README and your local harness config folders. Re-run this check before changing harness paths because vendors are still moving quickly.
