# Task: Design progressive skill loading APIs and behavior
**Task ID:** TCM-DES-002
**Stage:** design
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-TCM-DES-002
**Workflow:** vibe-design
**Model Override:** oauth-router/gpt-5.5
**Thinking Level:** high
**Dispatch Policy:** subagent
## Context
Parent session: orch-20260510-011233

Task title: Design progressive skill loading APIs and behavior
## Objective
Specify exact behavior for Skill Index, Skill Manifest, and Skill Pack loading.
## Scope
- skill_index tool schema
- skill_manifest tool schema
- skill_load tool schema
- Skill record normalization
- Multiple manifest behavior
- Error handling
- Path safety
- Coexistence with Pi native /skill:name commands
## Checklist
- [x] Tool schemas defined
- [x] Response formats specified
- [x] Errors/tests specified
## Definition of Done
- Tool schemas are build-ready
- Response formats are specified
- Edge cases and errors are specified
- Tests are listed
## Expected Artifacts
- docs/context-manager/Skill_Loading_Design.md
## Dependencies
- TCM-GEN-004
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- complete the task within scope
- use the listed workflow and skills when they are provided
- report blockers clearly
- if review sends this back, continue using the same conversation id when possible
- summarize what changed and what remains
## Notes
Completed directly. Artifact: docs/context-manager/Skill_Loading_Design.md