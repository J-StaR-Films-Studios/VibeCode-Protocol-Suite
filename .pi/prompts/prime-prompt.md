---
description: Prime the agent with project context before work
---
# Workflow: Prime Agent

> Pi prompt alias for the richer prime-agent workflow.

Load the project brain before doing anything else.
Your goal is to understand project health, constraints, current work, and the next likely task before execution begins.

---

## Steps

### 1. Check Project Health
Run lightweight verification first:

```bash
npx tsc --noEmit
python scripts/vibe-verify.py --quick 2>/dev/null
```

If type-check fails, note the existing errors before proceeding.
Do not pretend the repo is healthy if it is not.

### 2. Load Core Documentation
Read the most relevant core docs that exist, including:
- `docs/Coding_Guidelines.md`
- `docs/Project_Requirements.md`
- `docs/mockups/` contents
- any builder / handoff docs if present

### 3. Identify Current Work
Inspect:
- `docs/issues/`
- incomplete FRs
- recent changed files if relevant
- current branch / diff state when useful

Call out what appears to be:
- completed
- in progress
- pending
- blocked

### 4. Load Relevant Skills if the Project Demands It
If this is a Next.js project, load the Next.js standards skill.
If another domain is clearly in play, load the matching skill before execution.

### 5. State Context Aloud
Before continuing, acknowledge:
- project health
- what docs were found / missing
- incomplete FRs or current work items
- the next likely task
- the rules you will follow while working

Suggested checklist:
- TypeScript health
- coding-guideline status
- mockup availability
- issue availability
- next actionable task

### 6. Continue Into the User Request
Once primed, continue into execution with the loaded context.
Do not re-ask for information that is already present on disk.

---

## Output Rules
- be compact but concrete
- state what you found, not generic filler
- mention missing docs explicitly
- preserve verification context for the rest of the session

---

## User Request
$@
