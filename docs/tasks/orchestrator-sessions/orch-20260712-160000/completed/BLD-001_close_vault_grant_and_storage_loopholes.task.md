# Task BLD-001: Close vault grant and storage loopholes
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Fix confirmed vault v1 security flaws and add bounded v2 grant binding with focused tests.
## Scope
- .pi/extensions/takomi-vault grant issuance and adapters
- Scratch-data tests and corresponding feature documentation
## Context
Parent session: orch-20260712-160000

Task title: Close vault grant and storage loopholes
## Definition Of Done
- Model-supplied scope cannot skip human approval
- Once-use spending is atomic and races deny reuse
- Malformed vault/grant data fail closed
- macOS key is never put in argv
- Binding and field enforcement apply across env, stdin, and file use
## Expected Artifacts
- Vault source changes
- Repeatable focused vault tests
- Updated Takomi_Credential_Gateway.md documenting shipped behavior and remaining gaps
## Dependencies
- none
## Constraints
- Read issue #14 and existing code first.
- No real vault data, no live import/export/deploy.
- Preserve v1 entry points; fix confirmed gaps, no speculative new adapters.