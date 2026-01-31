---
description: Run the J-Star Code Reviewer loop to analyze and fix code quality issues.
---

# J-Star Code Review Workflow

This workflow executes the J-Star Reviewer on staged changes, allowing the agent to iteratively fix issues.

## 1. Build the Brain (Required once)
If you haven't indexed the project yet, or if major files have changed, run:
// turbo
```bash
jstar init
```

## 2. Stage Current Changes
Ensure all recent changes are staged so the reviewer can see them.
// turbo
```bash
git add .
```

## 3. Run Reviewer
Execute the review pipeline.

### Standard Review (Staged Changes)
```bash
jstar review
```
*Use this when changes are staged but not yet committed.*

### Retroactive Review (Oops Mode)
If you already committed changes but forgot to review:
```bash
jstar review --last
```
*Equivalent to checking the last commit `HEAD~1..HEAD`.*

### Branch/PR Review
If working on a feature branch, check against main:
```bash
jstar review --pr
```
*Equivalent to `git diff main...HEAD`. Use this for full feature verification.*

## 4. Analyze and Fix
**Agent Instructions:**
1.  **Read the Output**: Check `.jstar/last-review.md` or the console summary.
2.  **Prioritize**: Focus *only* on **P0_CRITICAL** and **P1_HIGH** issues first.
3.  **Looping Strategy**:
    - **IF** P0/P1 issues are found:
        - Apply fixes to the code.
        - Stage changes: `git add .`
        - (Optional) Re-index if you added new files: `jstar init`
        - Restart this workflow (Stage -> Review).
    - **IF** only P2_MEDIUM issues remain:
        - You may fix them if they are quick/obvious.
        - Otherwise, consider the code "Good Enough" and stop.
    - **MAX LOOPS**: 3. Do not run this cycle more than 3 times. If issues persist, stop and ask the user.

## 5. Handling False Positives (Debate Mode)

If the reviewer flags correct code as an issue (e.g., security false positives), use **Headless Chat** to resolve it.

**Protocol:**
1. **Start Session:**
   Use the `run_command` tool to start the background process:
   ```bash
   jstar chat --headless
   ```
   *Note: Capture the `CommandId` returned by this tool.*

2. **List Issues (Get IDs):**
   Use `send_command_input` with the `CommandId`:
   ```json
   {"action": "list"}
   ```
   *Wait for output. Identify the numeric `id` of the issue you want to challenge.*

3. **Debate:**
   Use `send_command_input` to explain why it's a false positive:
   ```json
   {"action": "debate", "issueId": 0, "argument": "This is correct because..."}
   ```
   *Use the integer `id` from step 2.*

4. **Verify Result:**
   Check the output for `"status": "resolved"` and `"verdict": "LGTM"`.

5. **Exit:**
   Terminate the session cleanly:
   ```json
   {"action": "exit"}
   ```

---

## AI Agent Mode (Headless)

For programmatic interaction without TUI navigation, use headless mode.

### JSON Review (One-Shot)
Get findings as JSON for parsing:
// turbo
```bash
jstar review --json > .jstar/report.json
```

### Headless Chat (Interactive Protocol)
For debating specific issues via stdin/stdout:
```bash
echo '{"action": "list"}' | jstar chat --headless
```

**Commands:**
| Action | Parameters | Description |
|--------|------------|-------------|
| `list` | — | List all current issues |
| `debate` | `issueId`, `argument` | Challenge an issue |
| `ignore` | `issueId` | Mark issue as ignored |
| `exit` | — | End session, get final report |

See [Headless Mode Docs](../docs/features/headless-mode.md) for full protocol.

### AI Fix Cycle
```
1. jstar review --json  →  Parse findings
2. Apply code fixes
3. git add .            →  Stage changes
4. jstar init           →  Update brain (if new files added)
5. jstar review --json  →  Verify fixes
6. Repeat until P0/P1 = 0
```
