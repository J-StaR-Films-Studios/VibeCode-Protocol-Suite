# Task: Create builder handoff and verification strategy
**Task ID:** TCM-GEN-006
**Stage:** genesis
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-TCM-GEN-006
**Workflow:** vibe-genesis
**Model Override:** openai-codex/gpt-5.4
**Thinking Level:** high
**Dispatch Policy:** subagent
## Context
Parent session: orch-20260510-011233

Task title: Create builder handoff and verification strategy
## Objective
Create a concise builder handoff explaining how Design/Build should proceed and how the user will verify the extension with local Pi dev commands.
## Scope
- Recommended implementation sequence
- Local extension location
- Testing commands
- Prompt-size verification
- Skill progressive-loading verification
- Subagent/model-routing verification
- Rollback/safety considerations
## Checklist
- [x] Create builder handoff
- [x] Create verification strategy
- [x] Include local/global Pi test commands
## Definition of Done
- docs/Builder_Prompt.md exists
- Verification checklist is explicit
- Includes user-provided test commands
- Clearly recommends Design next
## Expected Artifacts
- docs/Builder_Prompt.md
- docs/context-manager/Verification_Strategy.md
## Dependencies
- TCM-GEN-003
- TCM-GEN-004
- TCM-GEN-005
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- Include both test paths mentioned by the user: powershell script and global pi from outside this directory.
- Keep it practical for the Build agent.
## Notes
Completed directly. Artifacts: docs/Builder_Prompt.md and docs/context-manager/Verification_Strategy.md