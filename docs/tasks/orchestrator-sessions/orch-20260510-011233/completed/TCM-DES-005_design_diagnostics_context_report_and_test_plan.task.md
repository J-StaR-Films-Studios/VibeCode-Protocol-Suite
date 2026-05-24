# Task: Design diagnostics, context report, and test plan
**Task ID:** TCM-DES-005
**Stage:** design
**Status:** completed
**Role:** review
**Preferred Agent:** reviewer
**Conversation ID:** reviewer-TCM-DES-005
**Workflow:** vibe-design
**Model Override:** oauth-router/gpt-5.5
**Thinking Level:** medium
**Dispatch Policy:** review-first
## Context
Parent session: orch-20260510-011233

Task title: Design diagnostics, context report, and test plan
## Objective
Design the observable diagnostics needed to prove context reduction and debug loaded context decisions.
## Scope
- context_report tool schema
- /context-report command
- Stored last-build report shape
- Prompt size estimation
- Loaded/skipped/candidate pack reporting
- Verification scripts/manual tests
## Checklist
- [x] Diagnostics schema exists
- [x] Report examples exist
- [x] Test matrix maps to FRs
## Definition of Done
- Diagnostics schema exists
- Report examples exist
- Test plan maps to FR acceptance criteria
- Local/global Pi verification paths are included
## Expected Artifacts
- docs/context-manager/Diagnostics_And_Test_Design.md
## Dependencies
- TCM-GEN-006
- TCM-DES-001
- TCM-DES-002
- TCM-DES-003
- TCM-DES-004
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- complete the task within scope
- use the listed workflow and skills when they are provided
- report blockers clearly
- if review sends this back, continue using the same conversation id when possible
- summarize what changed and what remains
## Notes
Completed directly. Artifact: docs/context-manager/Diagnostics_And_Test_Design.md