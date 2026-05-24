# Task: Implement prompt rewrite, context router, dev script wiring, and documentation updates
**Task ID:** TCM-BLD-002
**Stage:** build
**Status:** completed
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-TCM-BLD-002
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.4
**Thinking Level:** high
**Dispatch Policy:** subagent
## Context
Parent session: orch-20260510-011233

Task title: Implement prompt rewrite, context router, dev script wiring, and documentation updates
## Objective
Replace verbose skill blocks with names-only index, surface candidates, wire local Pi dev script, and mark issue acceptance progress.
## Scope
- before_agent_start prompt rewrite
- candidate scoring
- scripts/pi-dev.ps1
- docs/issues acceptance criteria
## Checklist
- [x] Verbose available_skills block is compacted
- [x] Candidate hints are injected only when relevant
- [x] Local dev script loads extension
- [x] MUS issue acceptance criteria updated
## Definition of Done
- Verbose available_skills block is compacted
- Candidate hints are injected only when relevant
- Local dev script loads extension
- MUS issue acceptance criteria updated
## Expected Artifacts
- .pi/extensions/takomi-context-manager/index.ts
- scripts/pi-dev.ps1
- docs/issues/*.md
## Dependencies
- TCM-BLD-001
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
Implemented directly. Prompt rewrite, candidate router, local dev script wiring, and MUS issue checkbox updates are done.