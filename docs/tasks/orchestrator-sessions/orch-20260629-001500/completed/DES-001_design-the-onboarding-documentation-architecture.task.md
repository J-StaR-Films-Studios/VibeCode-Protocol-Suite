# DES-001 - Design the onboarding documentation architecture

## Objective

Define the target documentation structure, canonical docs, quick-start flow, runtime expectations, policy safety messaging, and cross-links for Codex plugin onboarding.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Choose the canonical onboarding guide path and explain why.
- [x] Define the guide sections in order.
- [x] Define which details belong in README versus feature docs versus the canonical guide.
- [x] Include project-local/global runtime safety boundaries.
- [x] Include troubleshooting topics and verification commands.

## Notes

Lifecycle: Design. Include project-local versus global runtime behavior and the no-Pi-required Codex-native path.

Recommended guide path: `docs/takomi-codex-onboarding.md`.

Design bias: keep README lightweight, keep `docs/features/Codex_Takomi_Plugin.md` implementation-focused, and make the onboarding guide the user-facing source of truth.

## Design Outcome

Canonical guide path: `docs/takomi-codex-onboarding.md`.

Reason: the plugin needs a stable user-facing guide that is not buried inside the long README or the implementation-heavy feature record. README should stay discoverable and short; the feature doc should stay architectural and historical.

## Guide Section Order

1. `Takomi Codex Plugin Onboarding`
2. What the plugin does
3. Which Takomi path to choose
4. Enable the repo-local plugin
5. First prompts to try
6. First-run verification
7. Policy loading and runtime detection
8. Roadbooks for broad work
9. Pi/Takomi and harness bridge safety
10. Troubleshooting
11. Next steps

## Source Responsibilities

| File | Responsibility |
| --- | --- |
| `README.md` | Short discovery entry point. Distinguish Codex plugin from skill-only and Pi harness paths. Link to the guide. |
| `docs/takomi-codex-onboarding.md` | Canonical user-facing onboarding guide with commands, safety notes, and first-run flow. |
| `docs/features/Codex_Takomi_Plugin.md` | Implementation record, acceptance criteria, script contracts, and a short pointer to the guide. |
| `plugins/takomi-codex/skills/takomi-codex/SKILL.md` | Agent-facing operating rules, not end-user onboarding. |

## Safety Boundaries

- Project roadbook/docs writes are allowed when requested.
- User/global paths such as `~/.pi/agent` and `~/.agents/skills` are read-only unless the user explicitly approves writes.
- `takomi-pi-dispatch.ps1` and `takomi-harness.ps1` must remain dry-run-first in docs; `-Execute` should be described as an explicit escalation.
- The plugin should be documented as Codex-native and Pi-optional.

## Verification And Troubleshooting Topics

- Use `pwsh` for script examples, especially `takomi-board.ps1`.
- Verify `takomi-detect.ps1`, `takomi-policy.ps1`, `takomi-doctor.ps1`, and `takomi-board.ps1 -Action show`.
- Mention missing `.pi`, missing `takomi`/`pi` CLIs, duplicate runtime surfaces, and Windows PowerShell 5 parse errors.
- Explain that missing Pi/Takomi can mean optional bridge features are unavailable, not that the Codex plugin itself is unusable.

## Update 2026-06-29T01:00:52

Started design pass for canonical onboarding guide structure and entry-point responsibilities.

## Update 2026-06-29T01:01:20

Completed docs architecture design. Canonical guide path is docs/takomi-codex-onboarding.md with README as discovery entry point and feature doc as implementation record.
