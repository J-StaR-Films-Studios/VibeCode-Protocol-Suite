---
description: Prime the agent with project coding guidelines, styling rules, and folder structure.
---

# Workflow: Prime Agent

> Load the project "brain" — coding guidelines, current work, and verification status.

---

## Steps

### 1. Check Project Health

Run verification to see current state:

```bash
# TypeScript check
npx tsc --noEmit

# Quick verification (if script exists)
python scripts/vibe-verify.py --quick 2>/dev/null
```

**If type-check fails:** There are existing errors. Note them for fixing.

---

### 2. Load Core Documentation

```bash
# Coding Guidelines (The Law)
cat docs/Coding_Guidelines.md 2>/dev/null || cat docs/coding_guidelines.md 2>/dev/null

# Project Requirements (PRD)
cat docs/Project_Requirements.md 2>/dev/null

# List mockups
ls docs/mockups/ 2>/dev/null
```

---

### 3. Identify Current Work

```bash
# List all issues
ls docs/issues/ 2>/dev/null

# Find incomplete FRs
grep -l "\- \[ \]" docs/issues/*.md 2>/dev/null
```

---

### 4. Load nextjs-standards Skill (If Next.js Project)

If `next.config.*` or `package.json` contains `"next"`:

```bash
# Read the skill
cat .agent/skills/nextjs-standards/SKILL.md 2>/dev/null
```

---

### 5. State Context Aloud

After loading, acknowledge:

"✅ **Agent Primed.**

**Project Health:**
- TypeScript: [PASS/FAIL - X errors]
- Lint: [PASS/FAIL]

**Context Loaded:**
- Coding Guidelines: [Found/Not Found]
- Mockups: [X files found / None]

**Current Work:**
- Incomplete FRs: FR-XXX, FR-YYY
- Next up: FR-XXX: [Title]

**Rules I will follow:**
- `tsc --noEmit` after every file edit
- Reference issue file for each FR
- Mark acceptance criteria as I complete them

What would you like me to work on?"

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npx tsc --noEmit` | Check for type errors |
| `python scripts/vibe-verify.py --quick` | Quick verification |
| `cat docs/Coding_Guidelines.md` | Load the law |
| `ls docs/issues/` | See all FRs |

---

## When to Use

- **Start of session** — Before any work
- **After `/agent_reset`** — Reload context after reset
- **Context lost** — Agent seems confused
- **Before complex work** — Ensure full context
