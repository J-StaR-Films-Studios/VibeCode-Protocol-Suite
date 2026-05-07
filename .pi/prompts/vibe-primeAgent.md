---
description: Prime the agent with project coding guidelines, current work, and verification status
---
# Workflow: Prime Agent

> Direct Takomi workflow prompt for priming a session.

Load the project brain before doing work.
This workflow is for grounding the session in project health, coding rules, current work, and likely next actions.

---

## Steps

### 1. Check Project Health
Run verification to see the current state:

```bash
npx tsc --noEmit
python scripts/vibe-verify.py --quick 2>/dev/null
```

If type-check fails, note the existing errors before proceeding.
Do not mask pre-existing failures.

### 2. Load Core Documentation
Read the most relevant docs that exist:
- `docs/Coding_Guidelines.md`
- `docs/Project_Requirements.md`
- `docs/mockups/`
- builder or handoff docs if present

### 3. Identify Current Work
Inspect:
- `docs/issues/`
- incomplete acceptance criteria
- recent work in progress
- obvious blockers

Summarize what appears to be:
- completed
- in progress
- pending
- blocked

### 4. Load Relevant Skills
If the project clearly matches a known skill domain, load that skill before continuing.
For Next.js work, load `nextjs-standards`.

### 5. State Context Aloud
Acknowledge:
- project health
- what context was loaded
- incomplete FRs or current work items
- the next likely task
- rules you will follow while working

Suggested summary format:

```text
✅ Agent Primed

Project Health:
- TypeScript: PASS/FAIL
- Verification script: Found/Not Found

Context Loaded:
- Coding Guidelines: Found/Not Found
- PRD: Found/Not Found
- Mockups: X files / None
- Issues: X files / None

Current Work:
- Incomplete FRs: ...
- Next likely task: ...

Rules I will follow:
- tsc --noEmit after every TS edit
- issue-driven implementation when issues exist
- explicit verification before handoff
```

### 6. Continue With the Request
After priming, continue directly into the user request using the loaded context.

---

## Output Rules
- be concrete, not generic
- name missing docs explicitly
- preserve verification context for the rest of the session
- keep the priming summary compact and useful

---

## User request:
$@
