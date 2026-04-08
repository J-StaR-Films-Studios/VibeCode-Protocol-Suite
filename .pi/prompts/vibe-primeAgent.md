---
description: Prime the agent with project coding guidelines, current work, and verification status
---
# Workflow: Prime Agent

Load the project brain before doing work.

## Steps

### 1. Check Project Health
Run verification to see current state:

```bash
npx tsc --noEmit
python scripts/vibe-verify.py --quick 2>/dev/null
```

If type-check fails, note the existing errors before proceeding.

### 2. Load Core Documentation

```bash
cat docs/Coding_Guidelines.md 2>/dev/null || cat docs/coding_guidelines.md 2>/dev/null
cat docs/Project_Requirements.md 2>/dev/null
ls docs/mockups/ 2>/dev/null
```

### 3. Identify Current Work

```bash
ls docs/issues/ 2>/dev/null
grep -l "\- \[ \]" docs/issues/*.md 2>/dev/null
```

### 4. Load nextjs-standards Skill if Relevant
If this is a Next.js project, load the nextjs-standards skill.

### 5. State Context Aloud
Acknowledge:
- project health
- context loaded
- incomplete FRs
- next likely task
- rules you will follow

Then continue with the user request.

User request:
$@
