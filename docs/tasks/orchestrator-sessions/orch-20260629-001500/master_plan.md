# Takomi Codex Plugin Onboarding Docs Roadbook

## Goal

Improve the onboarding documentation for the `takomi-codex` Codex plugin so a new Codex user can discover, install or enable, verify, and use Takomi lifecycle orchestration without needing to already understand Pi, Takomi, roadbooks, or project policy files.

This roadbook is documentation-only planning. Do not change implementation code until the build task is explicitly started.

## Context Intake

- Project requirements reviewed: `docs/Project_Requirements.md`
- Feature docs reviewed: `docs/features/Codex_Takomi_Plugin.md`
- README onboarding surface reviewed: `README.md`
- Plugin manifest reviewed: `plugins/takomi-codex/.codex-plugin/plugin.json`
- Skill entrypoint reviewed: `plugins/takomi-codex/skills/takomi-codex/SKILL.md`
- Marketplace metadata reviewed: `.agents/plugins/marketplace.json`
- Project runtime inspected: `.pi/`
- Policy context loaded: `.pi/settings.json`, `.pi/takomi-profile.json`, `.pi/takomi/model-routing.md`, `.pi/takomi/policies/`

## Runtime Detection

Command:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-detect.ps1
```

Detected state:

- Project `.pi`: present
- Project settings/profile/routing policy: present
- Project Takomi policy directory: present
- Project agents/prompts: present
- Existing roadbooks directory: present
- User `~/.pi/agent`: present
- User `~/.agents/skills`: present
- `takomi` CLI: available, version `2.1.37`
- `pi` CLI: available, version `0.80.2`

## Policy Context

Command:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-policy.ps1
```

Relevant policy findings:

- Project policy is authoritative over user/global policy.
- Lifecycle routing says small clear tasks stay direct, while broad or risky work should use Genesis, Design, Build, then Review/Finalize.
- Subagent routing says to delegate only when it reduces risk, improves parallelism, or provides specialist review.
- `reviewAfterImplementation` is enabled in `.pi/takomi-profile.json`.
- Role routing maps Genesis to architect, Design to designer, Build to orchestrator, and Review to reviewer.
- Model policy favors stronger reasoning for uncertain planning, architecture, regression checks, and final review.

## Resolved Onboarding Gaps

1. `README.md` now has a Codex Plugin Quick Start that distinguishes the repo-local plugin from the older skill-only path.
2. `docs/features/Codex_Takomi_Plugin.md` now links to the canonical onboarding guide and remains the implementation record.
3. `docs/takomi-codex-onboarding.md` now provides the first-run sequence for detection, policy loading, doctor checks, roadbooks, dry-run dispatch, and troubleshooting.
4. The onboarding guide now explains that the plugin works without Pi and adapts when Pi/Takomi runtime state exists.
5. The guide and feature doc now call out PowerShell 7 (`pwsh`) usage for scripts, including `takomi-board.ps1`.
6. Safety boundaries are now centralized in the guide: project docs may be updated when requested, while user/global `.pi` and `~/.agents` paths are read-only unless explicitly approved.

## Completed Documentation Shape

Canonical guide:

- `docs/takomi-codex-onboarding.md`

Entry point updates:

- `README.md` includes a short "Codex Plugin Quick Start" near the current Codex Takomi section.
- `docs/features/Codex_Takomi_Plugin.md` includes a concise link to the onboarding guide.

The guide covers:

- What the plugin is and when to use it.
- Installation/activation from repo-local marketplace metadata.
- Natural language triggers such as "use takomi-codex", "inspect runtime", and "create a roadbook".
- First-run verification commands: `detect`, `policy`, `doctor`, and `board show`.
- Roadbook layout and when roadbooks should be created.
- Pi/Takomi bridge behavior: dry-run first, execute only with explicit user intent or safe diagnostic commands.
- Policy loading and project-first precedence.
- Troubleshooting: missing `.pi`, missing CLIs, duplicate Pi extensions, PowerShell 5 parse errors, and plugin validator failures.

## Execution Mode

- Use markdown roadbook orchestration because this is a broad documentation improvement with multiple dependent tasks.
- Do not dispatch Pi/Takomi work yet. Runtime and policy commands were read-only diagnostics.
- Do not create Codex child threads for this first pass; task packets are sufficient and the next task is mostly sequential writing.

## Tasks

| Task | Status | Lifecycle | Notes |
| --- | --- | --- | --- |
| `GEN-001` Audit Takomi Codex onboarding surfaces | completed | Genesis | Feature doc and task packet now capture current surfaces, gaps, script safety, and first-run flow. |
| `DES-001` Design the onboarding documentation architecture | completed | Design | Canonical guide path, section order, source responsibilities, safety boundaries, and verification topics defined. |
| `BLD-001` Write the primary Codex plugin onboarding guide | completed | Build | `docs/takomi-codex-onboarding.md` created as the user-facing guide. |
| `BLD-002` Update README and feature doc entry points | completed | Build | README quick start and feature-doc onboarding pointer added. |
| `REV-001` Verify onboarding docs with script smoke checks | completed | Review | Review completed with cleanup findings applied; final smoke checks and plugin validation passed. |

## Recommended Next Step

Run `REV-001` whenever the onboarding guide changes again. The current build tasks are complete; future improvements should be additive refinements to the canonical guide or short entry-point links.

## Acceptance Criteria

- A new or updated onboarding guide explains the Codex plugin path separately from legacy skill-only installation.
- The guide includes a copy-pasteable first-run verification sequence using non-mutating commands.
- The guide documents runtime detection priority and project-first policy loading.
- The guide clearly states that Pi/Takomi is optional for Codex-native behavior.
- The guide includes safety boundaries for user/global config writes.
- The guide warns that `takomi-board.ps1` should be run with PowerShell 7 (`pwsh`) until Windows PowerShell 5 compatibility is fixed.
- README and feature docs link to the guide without duplicating it.
- Review records smoke-check commands and any unresolved risks.

## Verification

- [x] Runtime detection completed
- [x] Policy context loaded
- [x] Plugin doctor completed
- [x] Roadbook created with Takomi board script through PowerShell 7
- [x] `GEN-001` onboarding surface audit completed
- [x] Feature doc entry point updated with audit findings
- [x] Plugin validator passed after docs changes
- [x] Onboarding guide written
- [x] README entry point updated
- [x] Final docs review completed
