---
description: Continue building where the last agent left off. Use after initial build or in new sessions.
---

# Workflow: Continue Build

> Pick up where the last agent left off. Use this when:
> - Starting a new chat after initial build
> - Resuming work after a break
> - Context got lost mid-session

---

## Steps

### 1. Context Recovery

Read and internalize the project state:

```powershell
# Core documentation
cat docs/Coding_Guidelines.md       # The Law
cat docs/Project_Requirements.md    # The PRD

# List all issues
ls docs/issues/

# Check for mockups
ls docs/mockups/
```

**State aloud:**
- "I will run `tsc --noEmit` after every file edit"
- "I will reference issue files for each FR"
- "I will mark acceptance criteria as I complete them"

---

### 2. Health Check

Verify the project is in a good state:

```bash
# Check for uncommitted changes
git status

# Type-check current state
npx tsc --noEmit

# Quick verification (optional)
python scripts/vibe-verify.py --quick
```

**If type-check fails:** Fix existing errors before starting new work.

---

### 3. Progress Audit

Scan the issues folder to find incomplete work:

```powershell
# For each issue file, check for unchecked acceptance criteria
Get-Content docs/issues/*.md | Select-String "- \[ \]"
```

**Report:**
```
📊 **Progress Audit**

✅ Completed FRs:
- FR-001: [Title] (all criteria checked)
- FR-002: [Title] (all criteria checked)

🔄 In Progress:
- FR-003: [Title] (2/5 criteria done)

⏳ Not Started:
- FR-004: [Title]
- FR-005: [Title]
```

---

### 4. Verify Previous Work (Trust but Verify)

Before starting new work, spot-check that "completed" FRs actually work:

For each "completed" FR:
1. Check if the files mentioned in the issue exist
2. Check if the feature is accessible (route exists, component renders)
3. Quick manual sanity check

**If something is broken:**
- The previous agent lied
- Fix it first
- Uncheck the acceptance criteria that don't work

---

### 5. Resume Implementation

Pick up the next incomplete FR:

```
"📋 Resuming with FR-XXX: [Title]"
```

**For each FR:**

1. **Read the issue** — `docs/issues/FR-XXX.md`
2. **Implement** — Follow the Proposed Solution (adapt as needed)
3. **Verify** — `npx tsc --noEmit` after every file edit
4. **Mark complete** — Check off acceptance criteria
5. **Update issue** — Edit the file to reflect progress

---

### 6. Progress Checkpoints

After completing each FR, report:

```
✅ **FR-XXX Complete**

Acceptance Criteria:
- [x] Criterion 1
- [x] Criterion 2
- [x] Criterion 3

📈 Type-check: PASS
🎯 Next: FR-YYY: [Title]

Continue? (yes/no)
```

---

### 7. Session End

When stopping work (user says stop or all FRs done):

```
📊 **Session Summary**

This session:
- Completed: FR-XXX, FR-YYY
- Fixed: [any bugs found]
- In progress: FR-ZZZ (3/5 criteria done)

Overall project:
- Total FRs: X
- Completed: Y
- Remaining: Z

To continue: `/vibe-continueBuild`
To finalize: `/vibe-finalize`
```

---

## Handling Issues

### If Type-Check Fails

1. Read the error carefully
2. Fix the specific file
3. Re-run `tsc --noEmit`
4. Don't proceed until it passes

### If Previous Work is Broken

1. Document what's broken
2. Uncheck the relevant acceptance criteria
3. Fix before moving to new work
4. Re-check after fixing

### If Architecture Needs to Change

1. Announce the proposed change
2. Explain why the original approach doesn't work
3. Get user approval for significant changes
4. Update the issue file with new approach

