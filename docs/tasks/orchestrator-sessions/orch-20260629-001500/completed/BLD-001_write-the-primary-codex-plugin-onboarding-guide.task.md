# BLD-001 - Write the primary Codex plugin onboarding guide

## Objective

Create or update the canonical onboarding doc for Takomi Codex plugin installation, activation, runtime detection, policy loading, roadbook creation, dry-run dispatch, and troubleshooting.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [ ] Create `docs/takomi-codex-onboarding.md`.
- [ ] Explain what the plugin does and when to use it.
- [ ] Include install/activation notes for the repo-local plugin marketplace path.
- [ ] Include a first-run verification block using `pwsh` and non-mutating scripts.
- [ ] Explain policy loading, roadbooks, dry-run dispatch, and no-Pi fallback behavior.
- [ ] Include troubleshooting for missing runtime, missing CLIs, duplicate runtime surfaces, and PowerShell 5 parse errors.

## Notes

Lifecycle: Build. Recommended next build task after this roadbook.

Use real command output expectations from this roadbook:

- `takomi` CLI detected as `2.1.37`
- `pi` CLI detected as `0.80.2`
- Project `.pi`, settings, profile, routing policy, and policy files are present
- `takomi-doctor.ps1` passes

## Update 2026-06-29T01:03:24

Implementation worker created docs/takomi-codex-onboarding.md. Parent adjusted wording to match design architecture.

## Update 2026-06-29T01:03:37

Created docs/takomi-codex-onboarding.md as canonical user-facing guide covering activation, prompts, verification, policies, roadbooks, dry-run dispatch, no-Pi fallback, safety boundaries, and troubleshooting.
