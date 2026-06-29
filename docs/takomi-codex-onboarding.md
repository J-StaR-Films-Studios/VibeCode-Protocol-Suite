# Takomi Codex Plugin Onboarding

This is the canonical user-facing guide for the `takomi-codex` Codex plugin.

## What It Is

`takomi-codex` brings Takomi lifecycle orchestration into Codex as a repo-local plugin. It helps Codex choose the right execution mode for a request:

- direct Codex work for small tasks
- Genesis, Design, Build, Review, or Recovery routing for lifecycle work
- markdown roadbooks for broad multi-step work
- project-first policy loading when routing or model choices matter
- optional dry-run bridges to Pi, Takomi, or other supported harnesses

The plugin works without Pi installed. When Pi or Takomi runtime files are present, it can inspect them and adapt.

## When To Use It

Use `takomi-codex` when you want Codex to:

- plan or break down a feature before implementation
- create or update a Takomi roadbook
- inspect local Takomi or Pi runtime state
- follow project routing and review policies
- coordinate multi-step work with clear task packets
- recover, review, or audit ongoing work

For a tiny one-file edit, normal Codex is usually enough.

## Enable The Repo-Local Plugin

This repository exposes the plugin through:

```text
.agents/plugins/marketplace.json
```

The marketplace entry points at:

```text
./plugins/takomi-codex
```

In a Codex environment that supports repo-local plugins, enable or install `takomi-codex` from the repository marketplace. This is different from the older global skill install:

```powershell
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite --skill takomi
```

Use the plugin path when you want the Codex plugin package, local scripts, plugin metadata, and the `takomi-codex` skill. Use `skills add --skill takomi` when you only want the older global Takomi skill path.

## Natural Language Prompts

After the plugin is available, ask in plain language:

```text
use takomi-codex to inspect this repo
use Takomi to plan this feature
create a Takomi roadbook for this work
inspect the local Takomi runtime
use Takomi Review on the current changes
recover this task with Takomi
```

The plugin should choose the smallest useful mode. It should not create roadbooks, launch harnesses, or delegate work for trivial tasks.

## First-Run Verification

Run these commands from the repository root with PowerShell 7 (`pwsh`). They are non-mutating diagnostics:

```powershell
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-detect.ps1 -Root .
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-policy.ps1 -Root .
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-doctor.ps1 -Root .
```

Expected result:

- `takomi-detect.ps1` reports available project, user, CLI, and plugin runtime surfaces.
- `takomi-policy.ps1` displays resolved policy context without changing it.
- `takomi-doctor.ps1` reports readiness issues and remediation steps.

## Policy Loading

When policy matters, `takomi-codex` resolves project-local policy before user or global state:

```text
.pi/settings.json
.pi/takomi-profile.json
.pi/takomi/model-routing.md
.pi/takomi/policies/
```

User and global paths such as `~/.pi/agent/` and `~/.agents/skills/` are read-only unless the user explicitly approves a write.

## Roadbooks

For broad work, ask Codex to create or update a roadbook:

```text
create a Takomi roadbook for this feature
```

The script-backed roadbook location is:

```text
docs/tasks/orchestrator-sessions/<sessionId>/
```

Common commands:

```powershell
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root . -Action create -Title "Feature plan"
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root . -Action show -SessionId <sessionId>
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root . -Action summary -SessionId <sessionId>
```

`takomi-board.ps1` writes project-owned markdown under `docs/tasks/orchestrator-sessions/`. Use it when roadbook updates are part of the requested project-docs work.

## Dry-Run Dispatch

Pi and harness bridges are dry-run-first. Use them to inspect what would run:

```powershell
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-pi-dispatch.ps1 -Root . -Action status
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-pi-dispatch.ps1 -Root . -Action takomi -ArgsLine "doctor"
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-harness.ps1 -Root . -Action status
```

Only add `-Execute` when the user explicitly approves the target command and write scope, or when the action is known to be safe and read-only.

## No-Pi Fallback

Pi is optional. If `.pi/`, `pi`, or `takomi` are missing, the plugin should still:

- route normal Codex work through Takomi lifecycle judgment
- create markdown roadbooks when requested
- use bundled plugin guidance
- report missing runtime surfaces as diagnostics, not hard failures

## Safety Boundaries

- Project files may be changed only when the user requested that project work.
- User and global config are read-only unless the user approves writes.
- Dry-run bridge scripts must stay dry-run unless `-Execute` is intentionally used.
- Markdown roadbooks are the human-readable source of truth.
- JSON or external runtime state must not replace readable roadbooks.
- Multi-thread or subagent delegation is optional and only useful for broad, independent tasks.

## Troubleshooting

### Missing runtime or CLIs

If `takomi` or `pi` is missing, run:

```powershell
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-doctor.ps1 -Root .
```

Missing CLIs do not block Codex-native plugin behavior. Install or repair the CLI only if you need Pi/Takomi bridge execution.

### Duplicate runtime surfaces

If doctor output reports duplicate or overlapping project/global runtime hints, prefer project-local policy and ask Codex to summarize what it detected:

```text
use takomi-codex to inspect duplicate runtime surfaces and recommend which policy wins
```

Do not delete or rewrite global runtime folders just to remove duplicates.

### Windows PowerShell 5 parse errors

Some scripts use syntax that Windows PowerShell 5 cannot parse, such as null-coalescing operators. Run them with PowerShell 7:

```powershell
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root . -Action show -SessionId <sessionId>
```

If `pwsh` is missing, install PowerShell 7 or ask Codex to use a compatible diagnostic path that does not execute the affected script.

### Plugin is not visible

Check that `.agents/plugins/marketplace.json` still contains the local `takomi-codex` entry and that the plugin package exists at `plugins/takomi-codex/`. Then restart or refresh the Codex plugin surface if your client requires it.
