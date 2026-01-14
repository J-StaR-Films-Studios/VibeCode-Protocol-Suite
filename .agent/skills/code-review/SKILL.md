---
name: code-review
description: Run J-Star code review on staged changes. Analyze, fix P0/P1 issues, and iterate until clean.
---

# Code Review Skill

Run the J-Star Reviewer on staged changes, allowing iterative fixing of issues.

## When to Use
- Before committing code changes
- When code quality issues are mentioned
- As a quality gate before merging
- When user asks to "review this code"

## Quick Start

### 1. Build the Brain (First Time Only)
```bash
jstar init
```

### 2. Stage Changes
```bash
git add .
```

### 3. Run Review
```bash
# Standard review (staged changes)
jstar review

# Retroactive (already committed)
jstar review --last

# Branch/PR review (against main)
jstar review --pr
```

## Fix Loop Protocol

1. **Read Output**: Check `.jstar/last-review.md` or console
2. **Prioritize**: Focus on **P0_CRITICAL** and **P1_HIGH** only
3. **Loop Strategy**:
   - If P0/P1 found → Fix → Stage → Re-review
   - If only P2_MEDIUM → Consider "Good Enough"
   - **MAX LOOPS: 3** — If issues persist, stop and ask user

## Handling False Positives (Headless Mode)

```bash
# Start headless session
jstar chat --headless

# List issues
echo '{"action": "list"}' | jstar chat --headless

# Debate an issue
echo '{"action": "debate", "issueId": 0, "argument": "This is correct because..."}' | jstar chat --headless

# Exit
echo '{"action": "exit"}' | jstar chat --headless
```

## AI Fix Cycle
```
1. jstar review --json  →  Parse findings
2. Apply code fixes
3. git add .            →  Stage changes
4. jstar init           →  Update brain (if new files added)
5. jstar review --json  →  Verify fixes
6. Repeat until P0/P1 = 0
```

## Headless Commands
| Action | Parameters | Description |
|--------|------------|-------------|
| `list` | — | List all current issues |
| `debate` | `issueId`, `argument` | Challenge an issue |
| `ignore` | `issueId` | Mark issue as ignored |
| `exit` | — | End session, get final report |
