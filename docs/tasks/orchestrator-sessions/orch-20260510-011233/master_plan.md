# Master Plan: Takomi Context Manager Genesis

**Session ID:** orch-20260510-011233
**Runtime Mode:** hybrid
**Session Intent:** full-project

## Lifecycle

### Genesis
- Status: completed
- Tasks: TCM-GEN-001, TCM-GEN-002, TCM-GEN-003, TCM-GEN-004, TCM-GEN-005, TCM-GEN-006
- Expandable: yes
- Expanded At: 2026-05-10T00:16:20.494Z
### Design
- Status: pending
- Tasks: none yet
- Expandable: yes
### Build
- Status: pending
- Tasks: none yet
- Expandable: yes
## Tasks

| ID | Stage | Title | Status | Role | Preferred Agent | Workflow | Model | Thinking | Dispatch | Skills |
|---|---|---|---|---|---|---|---|---|---|---|
| TCM-GEN-001 | genesis | Genesis foundation for takomi-context-manager | completed | architect | architect | vibe-genesis | openai-codex/gpt-5.5 | high | subagent | - |
| TCM-GEN-002 | genesis | Audit current Pi/Takomi prompt bloat and context injection sources | completed | architect | architect | vibe-genesis | openai-codex/gpt-5.5 | high | subagent | - |
| TCM-GEN-003 | genesis | Define Takomi Context Manager PRD and MUS/Future requirements | completed | architect | architect | vibe-genesis | openai-codex/gpt-5.5 | high | subagent | - |
| TCM-GEN-004 | genesis | Create 1:1 FR issue scaffolding for takomi-context-manager | completed | architect | architect | vibe-genesis | openai-codex/gpt-5.4 | high | subagent | - |
| TCM-GEN-005 | genesis | Define orchestration-quality requirements to prevent lazy task decomposition | completed | architect | architect | vibe-genesis | openai-codex/gpt-5.5 | high | subagent | - |
| TCM-GEN-006 | genesis | Create builder handoff and verification strategy | completed | architect | architect | vibe-genesis | openai-codex/gpt-5.4 | high | subagent | - |

## Notes

- Human-readable task docs live in this session folder.
- Machine state lives in `.pi/takomi/orchestrator/<sessionId>.json`.
- Sending a task back to the same agent should reuse its conversationId when continuity is helpful.
- Sessions follow the Genesis -> Design -> Build lifecycle, but each stage may stay compact or expand into more tasks.