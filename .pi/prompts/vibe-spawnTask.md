---
description: Spawn a detailed self-contained task prompt for implementing a feature or fixing a bug
---
# Workflow: Spawn Task

> Direct Takomi workflow prompt for creating executable task packets.

You are a **Task Architect** creating comprehensive, self-contained task prompts.
The output should be detailed enough that another agent — or your future self — can execute it without needing missing context filled in later.

---

## Steps

### 1. Task Discovery
Gather and clarify:
- task description
- priority
- scope
- exclusions
- timeline if relevant
- whether this is a feature, bug fix, refactor, or documentation task

If the request is fuzzy, tighten it before generating the task.

### 2. Current State Analysis
Inspect related files, docs, and issues.
Document:
- what is already completed
- what is currently in progress
- what is still pending
- what blockers or dependencies exist

Useful sources include:
- related source files
- `docs/features/`
- `docs/issues/`
- builder / handoff docs
- recent git diff when helpful

### 3. Generate the Task Prompt
Create a task prompt in `docs/tasks/[TaskName].md` including:
- objective
- priority
- scope
- relevant functional requirements
- technical requirements
- implementation plan by phase
- files to create or modify
- dependencies
- risks / gotchas
- success criteria
- verification expectations
- getting started steps

Recommended structure:

```markdown
# 🎯 Task: [Task Name]

**Objective:** [Clear, measurable goal]
**Priority:** [High/Medium/Low]
**Type:** [Feature/Bug/Refactor/Docs]
**Scope:** [Included / excluded]

---

## Context
[What exists already and why this task matters]

## Requirements
### Functional Requirements
- [REQ-001] ...
- [REQ-002] ...

### Technical Requirements
- [TECH-001] ...
- [TECH-002] ...

## Implementation Plan
### Phase 1: Discovery / Setup
- [ ] ...

### Phase 2: Core Implementation
- [ ] ...

### Phase 3: Verification / Polish
- [ ] ...

## Files to Create / Modify
| File | Action | Purpose |
|------|--------|---------|
| `src/...` | Modify | ... |

## Dependencies
- Depends on: ...
- Related docs: ...
- Blockers: ...

## Success Criteria
- [ ] All functional requirements implemented
- [ ] TypeScript / lint / tests pass as applicable
- [ ] Edge cases handled

## Getting Started
1. Read this task completely
2. Review related files
3. Start with Phase 1
```

### 4. Related Tracking
If useful, propose whether the task should also be tracked in GitHub or another issue system.
Do not force external tracking if the repo does not use it.

### 5. Confirmation
Return a compact summary with:
- created file path
- whether the task is ready to execute
- key dependencies or blockers
- whether external tracking is recommended

---

## Output Rules
- make the task self-contained
- include concrete file paths whenever possible
- keep scope explicit so the task cannot sprawl
- give enough detail for handoff, but avoid bloated filler

---

## User request:
$@
