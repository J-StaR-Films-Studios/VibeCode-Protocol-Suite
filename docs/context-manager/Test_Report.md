# Takomi Context Manager Test Report

## Date

2026-05-10

## Scope

Manual and smoke verification for the project-local `takomi-context-manager` Pi extension.

## Commands Run

### Targeted TypeScript Check

```bash
npx tsc --noEmit --pretty false 2>&1 | rg "takomi-context-manager" || true
```

Result: no extension-specific TypeScript errors after latest changes.

### Pi Load Smoke Test

```bash
powershell -ExecutionPolicy Bypass -File ./scripts/pi-dev.ps1 --help
```

Result: Pi help renders successfully with project-local extensions loaded explicitly.

## Verified Behaviors

### Skill Context Reduction

Observed context report from user testing:

- Original prompt: `47,271` chars
- Rewritten prompt: `14,883` chars
- Reduction: about `68.5%`
- Removed section: available skill descriptions

### Progressive Skill Loading

Implemented and ready for interactive verification:

- `skill_index` returns names only.
- `skill_manifest` returns selected skill descriptions and locations.
- `skill_load` loads full `SKILL.md` only for a selected skill.

### Takomi Routing Source of Truth

Verified implementation reads actual Takomi routing flow:

- `/takomi routing <policy>` writes `.pi/takomi/model-routing.md`.
- `/takomi routing` updates `.pi/settings.json -> takomi.modelRoutingPolicyFile`.
- `/takomi routing` derives `subagents.agentOverrides` from model names in policy text.
- `takomi-context-manager` consumes this artifact and does not own/generate model-routing policy content.

### Subagent Policy Prerequisite Gate

Verified by user screenshots:

- First `takomi_subagent` attempt before policy load is blocked.
- Block response includes the model-routing policy content.
- Policy is marked loaded.
- Agent is instructed to retry the original tool call.

### Invalid Model / Provider Recovery

Implemented and partially verified by user testing:

- Invalid model/provider requests are detected before `takomi_subagent` execution.
- Approved models are derived from Takomi routing/settings.
- UI recovery prompt can let the user select a policy-approved retry model.
- If user chooses stop, the extension calls `ctx.abort?.()` to end the active agent turn.

### Duplicate Extension Diagnostics

Implemented:

- Detects known duplicate global/project Takomi extension files for:
  - `takomi_workflow`
  - `takomi_board`
  - `takomi_subagent`
- Adds warnings to `context_report` with remediation guidance.

## Known Non-Blocking Issues

### Full Project TypeScript

`npx tsc --noEmit` is still blocked by existing `pi-subagents` dependency/package TypeScript errors unrelated to `takomi-context-manager`.

### Package Defaults

Local state/config folders are ignored and should not be packaged as defaults:

- `.pi/takomi/policies/`
- `.pi/takomi/context-manager/`

`.npmignore` was updated to exclude these from npm packaging.

## Recommended Follow-Up Tests

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1
```

Then test:

1. `context_report` with verbose mode.
2. `policy_manifest` for `model-routing`.
3. `skill_index`.
4. `skill_manifest takomi optimize-agent-context`.
5. `skill_load takomi`.
6. `takomi_subagent` before model policy is loaded.
7. `takomi_subagent` with `openai-codex/gpt-5.4-mini` and verify correction to policy provider.
8. `takomi_subagent` with `random-provider/not-real`, choose stop, verify the loop aborts.
9. Run global Pi with duplicate global/project Takomi extensions and confirm `context_report` warns.

## Status

Build is usable for continued interactive testing. Remaining work is hardening and packaging review.
