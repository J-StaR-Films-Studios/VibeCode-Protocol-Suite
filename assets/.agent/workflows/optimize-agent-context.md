---
description: Create, audit, or optimize agent.md / claude.md / cursorrules files using the Band-Aid Philosophy. Strips bloat, enforces minimalism.
---

# Workflow: Optimize Agent Context

> Shortcut to the `optimize-agent-context` skill. Creates minimal, effective AI agent instruction files.

---

## Steps

### 1. Load the Skill

```bash
cat .agent/skills/optimize-agent-context/SKILL.md
```

Read the full skill instructions before proceeding.

---

### 2. Determine Mode

Ask the user which mode they need:

| Mode | Trigger |
|---|---|
| **A: Create** | No existing file, or starting fresh |
| **B: Audit** | Has an existing agent.md / claude.md to optimize |
| **C: Band-Aid** | Quick fix for a specific agent mistake |

---

### 3. Execute

Follow the corresponding Mode (A, B, or C) from the skill instructions exactly.

---

### 4. Deliver

- Save the generated/optimized file to the user's preferred location
- Show before/after line count (Mode B)
- Confirm with user before overwriting any existing file

---

## When to Use

- **New project** — Create a minimal agent.md from scratch
- **Existing bloated file** — Audit and strip an overgrown context file
- **Agent keeps messing up** — Add a targeted Band-Aid rule
- **Cost optimization** — Reduce token overhead from verbose context files
