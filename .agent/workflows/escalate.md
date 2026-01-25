---
description: Generate a self-contained Escalation Report when stuck, for handoff to another agent.
---
# Workflow: Escalate (Damage Report Generator)

**System Instruction:**
You have been asked to **stop trying to solve the problem** and instead generate a comprehensive "Escalation Handoff Report."
This report will be used by a senior AI Orchestrator (in a new session) to diagnose and fix the issue.

**Your Goal:** Create a **self-contained** report that includes EVERYTHING the next agent needs, including the full content of relevant files AND instructions for the Orchestrator.

---

## Steps

### 1. Undo Broken Changes
Before generating the report, undo any uncommitted changes that are causing the failure.
```bash
git status
git checkout -- .  # Or selectively revert specific files
```

### 2. Generate Escalation Report
Create the file `docs/escalation_report.md` with the following structure:

```markdown
# Escalation Handoff Report

**Generated:** [Current Date/Time]
**Original Issue:** [GitHub Issue # or task description]

---

## PART 1: THE DAMAGE REPORT

### 1.1 Original Goal
[State the task you were asked to complete]

### 1.2 Observed Failure / Error
[Provide the FULL, EXACT error message or description of incorrect behavior]

```
[Paste exact error/traceback here]
```

### 1.3 Failed Approach
[Summarize the implementation strategy you attempted]

### 1.4 Key Files Involved
[List the files you created or modified]
- `path/to/file1.ts`
- `path/to/file2.ts`

### 1.5 Best-Guess Diagnosis
[Your hypothesis for WHY the approach failed]

---

## PART 2: FULL FILE CONTENTS (Self-Contained)

Below is the FULL content of each relevant file.

### File: `path/to/file1.ts`
```typescript
[ENTIRE FILE CONTENT]
```

### File: `path/to/file2.ts`
```typescript
[ENTIRE FILE CONTENT]
```

(Continue for all files listed above)

---

## PART 3: DIRECTIVE FOR ORCHESTRATOR

**Attention: Senior AI Orchestrator**

You have received this Escalation Handoff Report. A local agent has failed to solve this problem.

**Your Directive:**
1. **Analyze the Failure:** Based on Part 1 (the report) and Part 2 (the code), diagnose the TRUE root cause. Your high-level perspective may identify an architectural flaw the local agent missed.

2. **Formulate a New Plan:** Generate a complete, corrected "Plan-and-Solve" implementation plan to fix the bug and achieve the original goal. This plan should detail:
   - The exact code changes needed
   - The order of operations
   - Any architectural changes required

3. **Execute or Hand Off:** Either implement the fix yourself, or generate a clear, step-by-step prompt for a Builder agent.

**Begin your analysis now.**
```

### 3. Agent Action: Embed File Contents
**CRITICAL:** For each file listed in "Key Files Involved", you MUST:
1. Read the full content of the file using your file viewing tools.
2. Embed the ENTIRE content into Part 2 of the report.
3. Use proper markdown code fences with language hints.

### 4. Confirmation
Tell the user:
"📋 **Escalation Report Generated.**
Saved to: `docs/escalation_report.md`

This report is **fully self-contained** and includes:
- The Damage Report (what failed)
- Full file contents (the code)
- Orchestrator Directive (what the next agent should do)

To continue, open a **new Agent session** and paste the content of this file."
