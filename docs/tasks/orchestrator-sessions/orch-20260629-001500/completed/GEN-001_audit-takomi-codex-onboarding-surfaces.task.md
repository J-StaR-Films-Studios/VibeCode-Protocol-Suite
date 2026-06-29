# GEN-001 - Audit Takomi Codex onboarding surfaces

## Objective

Map the current README, feature doc, plugin manifest, marketplace metadata, skill entrypoint, and scripts into a user onboarding journey for installing, verifying, and using the Takomi Codex plugin.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] List every current onboarding surface and whether it targets skills, the Codex plugin, Pi runtime, or generic Takomi CLI use.
- [x] Identify confusing overlaps between `README.md`, `docs/features/Codex_Takomi_Plugin.md`, plugin manifest prompts, and the skill entrypoint.
- [x] Record the minimum first-run flow a new user should follow.
- [x] Capture doc gaps that should be fixed by the Design and Build tasks.

## Notes

Lifecycle: Genesis. Focus on docs only. Do not change implementation code.

Relevant files:

- `README.md`
- `docs/features/Codex_Takomi_Plugin.md`
- `.agents/plugins/marketplace.json`
- `plugins/takomi-codex/.codex-plugin/plugin.json`
- `plugins/takomi-codex/skills/takomi-codex/SKILL.md`
- `plugins/takomi-codex/scripts/*.ps1`

## Audit Findings

### Current Surfaces

| Surface | Primary Audience | Current Role |
| --- | --- | --- |
| `README.md` | General Takomi users | Explains Pi harness setup, context manager, global skills install, per-project setup, and Codex skill-native usage. |
| `docs/features/Codex_Takomi_Plugin.md` | Maintainers/builders | Records the plugin blueprint, architecture, scripts, write policy, acceptance criteria, and prior verification. |
| `.agents/plugins/marketplace.json` | Codex plugin discovery | Points Codex at the repo-local plugin source `./plugins/takomi-codex`. |
| `plugins/takomi-codex/.codex-plugin/plugin.json` | Codex plugin install surface | Provides display name, descriptions, default prompts, category, capabilities, and brand assets. |
| `plugins/takomi-codex/skills/takomi-codex/SKILL.md` | Codex agent/operator | Defines Takomi lifecycle routing, context pass, runtime detection, policy loading, roadbook orchestration, and safe dispatch rules. |
| `plugins/takomi-codex/scripts/*.ps1` | Operators/verifiers | Provides detect, policy, doctor, board, dispatch, and harness command surfaces. |

### Confusing Overlaps

- `README.md` has a `Codex Takomi Skills` section, but not a separate `takomi-codex` plugin onboarding path. New users may think the skill-only install is the plugin path.
- `docs/features/Codex_Takomi_Plugin.md` contains enough detail to verify the plugin, but it reads like an implementation spec rather than a first-run guide.
- Plugin manifest default prompts are helpful but do not teach users how to verify runtime state or create/show a roadbook.
- The skill entrypoint has the right operator rules, but it is written for Codex behavior rather than user onboarding.
- Script names are clear once the user knows them, but there is no canonical ordered flow for `detect`, `policy`, `doctor`, and `board`.
- `docs/features/Codex_Takomi_Plugin.md` still had stale approval-gate wording even though implementation notes show the plugin has already been built and validated.
- Users need a script safety matrix that separates read-only diagnostics, project-doc writes, and external runtime execution guarded by `-Execute`.

### Minimum First-Run Flow

1. Enable the repo-local `takomi-codex` plugin exposed by `.agents/plugins/marketplace.json`.
2. Ask Codex to use `takomi-codex` for a lifecycle, runtime, policy, or roadbook task.
3. Verify runtime state with `takomi-detect.ps1`.
4. Load policy context with `takomi-policy.ps1` when routing, models, subagents, or review matter.
5. Run `takomi-doctor.ps1` for plugin readiness.
6. For broad work, create or inspect a roadbook under `docs/tasks/orchestrator-sessions/<sessionId>/`.
7. Treat Pi/Takomi dispatch as dry-run by default and require explicit user approval before executing commands that write or dispatch work.

### Gaps For Later Tasks

- `DES-001` should define `docs/takomi-codex-onboarding.md` as the canonical guide and decide which details stay in README versus the feature doc.
- `BLD-001` should write the guide with a copy-pasteable first-run verification sequence.
- `BLD-002` should add concise links from README and this feature doc without duplicating the guide.
- `REV-001` should verify the guide against real command behavior and keep the PowerShell 7 note visible.

### Verification Notes

- Runtime and policy were inspected during roadbook creation.
- Subagent support was used for an independent docs-surface audit.
- Feature doc updated with the onboarding surface audit.
- Feature doc stale approval-gate wording replaced with current status.
- Feature doc updated with a script safety matrix.
- No runtime or implementation files were changed.

## Update 2026-06-29T00:41:54

Started docs-only onboarding surface audit with subagent support. No implementation code changes planned.

## Update 2026-06-29T00:44:08

Completed docs-only onboarding surface audit. Updated docs/features/Codex_Takomi_Plugin.md with current surfaces, gaps, script safety matrix, first-run journey, and next docs step. Plugin validation passed after docs changes.
