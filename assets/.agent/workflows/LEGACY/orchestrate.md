---
description: The Orchestrator - Autonomously builds projects using sub-agents
---

# /orchestrate - The VibeCode Brain

This is the **master workflow** that understands all other workflows and orchestrates them to build complete projects autonomously.

## Prerequisites
- Kilo Code or similar multi-agent spawning capability
- Git repository initialized
- User has provided a high-level project goal

---

## Phase 0: Prime Self (Understand Available Tools)

**Objective:** Load knowledge of all available workflows.

1. **Read the README workflow:**
   ```
   Read: .agent/workflows/README.md (or global workflows README)
   ```

2. **Parse user's goal** into:
   - **Project Type:** Web App | CLI | API | Library | Desktop | Mobile
   - **Stack:** Next.js | Python | Rust | Go | etc.
   - **Scope:** MVP | Full Product | Feature Addition

3. **Determine execution path:**
   | Scenario | Path |
   |----------|------|
   | New project from scratch | Genesis → Design → Build → Features |
   | Existing project, new feature | Reverse Genesis → Spawn Task → Build |
   | Bug fix / refactor | Prime Agent → Review Code → Fix |

---

## Phase 1: Planning (Genesis)

**Objective:** Generate project blueprint.

### For New Projects:
1. **Spawn Sub-Agent** with workflow: `/init_vibecode_genesis`
2. **Input:** User's goal description
3. **Wait for outputs:**
   - `docs/Project_Requirements.md`
   - `docs/Coding_Guidelines.md`
   - `docs/Builder_Prompt.md`
   - GitHub Issues (if connected)
4. **Parse PRD** to extract:
   - MUS (Minimum Usable State) features list
   - Tech stack decisions
   - Data models

### For Existing Projects:
1. **Spawn Sub-Agent** with workflow: `/reverse_genesis`
2. **Wait for:** `docs/autopsy_report.md`
3. **Parse report** to understand current architecture

**Checkpoint:** Confirm planning artifacts exist before proceeding.

---

## Phase 2: Design (Optional, Parallel-Safe)

**Objective:** Create visual design system and mockups.

**Condition:** Only run if `Project Type` includes UI (Web App, Desktop, Mobile).

1. **Spawn Sub-Agent** with workflow: `/init_vibecode_design`
2. **Wait for outputs:**
   - `docs/design/design-system.html`
   - `docs/mockups/*.html`
3. **Validate:** At least one mockup exists for each major feature

**Note:** This can run in parallel with Phase 3 scaffold if needed.

---

## Phase 3: Build Foundation

**Objective:** Scaffold project structure and core infrastructure.

1. **Spawn Sub-Agent** with workflow: `/build_vibecode_project` (or `v2` for Windows/pnpm)
2. **Input:** Builder Prompt from Phase 1
3. **Wait for outputs:**
   - Project structure created
   - Core dependencies installed
   - `docs/Builder_Handoff_Report.md`
4. **Post-Build Setup:**
   - Spawn `/spawn-jstar-code-review` to add code review tooling
   - Spawn `/init_smart_ops` to set up GitHub automation

**Checkpoint:** Verify `src/` directory exists and project builds.

---

## Phase 4: Feature Wave (Parallel Execution)

**Objective:** Build all MUS features using parallel agents.

### Step 1: Prepare Isolation Environments
1. **Parse MUS features** from `docs/Project_Requirements.md`
2. **Group features** into waves:
   - **Wave 1:** Core/foundational features (run first)
   - **Wave 2:** Independent features (run in parallel)
   - **Wave 3:** Features with dependencies (run after Wave 2)

3. **For each parallel feature:**
   ```bash
   # Use /git_worktree to isolate
   git branch feat-[feature-name]
   git worktree add ../[project]-feat-[feature-name] feat-[feature-name]
   ```

### Step 2: Spawn Feature Agents
For each feature in the current wave:

1. **Spawn Sub-Agent** with workflow: `/spawn_task`
2. **Input:**
   - Feature name and description from PRD
   - Relevant mockup (if exists)
   - Coding guidelines
3. **Wait for:** `docs/tasks/TASK-[feature].md`

4. **Spawn Builder Sub-Agent** in the worktree:
   - Workflow: `/build_vibecode_project` (feature mode)
   - Input: Task prompt from above
   - Working directory: The isolated worktree

5. **Monitor for:**
   - **Success:** Feature complete marker
   - **Stuck:** `/escalate` report generated
   - **Quality issue:** `/review_code` failures

### Step 3: Handle Results
| Outcome | Action |
|---------|--------|
| ✅ Feature complete | Queue for merge |
| ⚠️ Review issues | Re-spawn with fix instructions |
| ❌ Agent stuck | Read escalation report, re-assign or ask user |

### Step 4: Merge Wave
1. For each completed worktree:
   ```bash
   cd ../[project]-feat-[feature]
   git add . && git commit -m "feat: [feature-name]"
   git checkout main
   git merge feat-[feature-name]
   ```
2. Resolve any merge conflicts (or escalate to user)
3. Clean up worktrees:
   ```bash
   git worktree remove ../[project]-feat-[feature]
   git branch -d feat-[feature-name]
   ```

**Repeat** for each wave until all features complete.

---

## Phase 5: Quality Gate

**Objective:** Ensure codebase is production-ready.

### Step 1: Full Code Review
1. **Spawn Sub-Agent** with workflow: `/review_code`
2. **Scope:** `--pr` mode (full diff against initial state)
3. **Wait for:** `.jstar/last-review.md`

### Step 2: Deep Audit (If Critical Project)
1. **Spawn Sub-Agent** with workflow: `/deep_code_audit`
2. **Scope:** `FULL_SCAN`
3. **Wait for:** `.jstar/audit_report.md`

### Step 3: Handle Issues
| Severity | Action |
|----------|--------|
| P0_CRITICAL | Halt. Spawn fix agent immediately. |
| P1_HIGH | Spawn fix agent, continue other checks. |
| P2_MEDIUM | Log for later. Continue. |
| INFO | Ignore. |

### Step 4: Fix Loop
If issues found:
1. Spawn fix agent(s) for each issue
2. Re-run review after fixes
3. **Max loops:** 3. If still failing, escalate to user.

**Checkpoint:** All P0/P1 issues resolved.

---

## Phase 6: Documentation Sync

**Objective:** Ensure docs match final implementation.

1. **Spawn Sub-Agent** with workflow: `/sync_docs`
2. **Input:** List of all files changed
3. **Wait for:** Updated `docs/features/*.md`

---

## Phase 7: Finalize & Report

**Objective:** Close out the project build.

1. **Generate Handoff Report:**
   ```markdown
   # Project Build Complete
   
   ## Summary
   - **Features Built:** [count]
   - **Total Agents Spawned:** [count]
   - **Total Time:** [duration]
   
   ## Features Delivered
   - [x] Feature A
   - [x] Feature B
   - [x] Feature C
   
   ## Quality Status
   - Code Review: ✅ Passed
   - Security Audit: ✅ Passed
   
   ## Next Steps
   - [ ] Deploy to staging
   - [ ] User acceptance testing
   ```

2. **Notify User:** Project complete, ready for review.

---

## Error Handling

### Agent Stuck
When a sub-agent generates an `/escalate` report:
1. Read the escalation report
2. Determine if it's:
   - **Recoverable:** Re-spawn with additional context
   - **Blocking:** Pause orchestration, notify user
   - **Skip-able:** Mark feature as incomplete, continue

### Merge Conflicts
When git merge fails:
1. Attempt auto-resolution for simple conflicts
2. If complex, spawn a dedicated "conflict resolver" agent
3. If still failing, escalate to user with diff

### Build Failures
When project fails to build:
1. Capture error output
2. Spawn diagnostic agent to analyze
3. Apply fix and re-attempt build
4. Max retries: 3

---

## Configuration

The orchestrator can be configured via `.orchestrator.json`:

```json
{
  "maxParallelAgents": 4,
  "maxRetries": 3,
  "qualityGate": "strict",
  "autoMerge": true,
  "notifyOnComplete": true,
  "skipDesign": false,
  "skipAudit": false
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `maxParallelAgents` | 4 | Max concurrent feature agents |
| `maxRetries` | 3 | Retry limit per failed operation |
| `qualityGate` | "strict" | "strict" = P0/P1 must pass, "relaxed" = P0 only |
| `autoMerge` | true | Auto-merge completed features |
| `notifyOnComplete` | true | Notify user when done |
| `skipDesign` | false | Skip Phase 2 even for UI projects |
| `skipAudit` | false | Skip deep audit in Phase 5 |

---

## Quick Reference

| Phase | Workflow Used | Parallel? |
|-------|---------------|-----------|
| 0. Prime | `/README` | — |
| 1. Planning | `/init_vibecode_genesis` or `/reverse_genesis` | No |
| 2. Design | `/init_vibecode_design` | Yes (with Phase 3) |
| 3. Build | `/build_vibecode_project` | No |
| 4. Features | `/git_worktree` + `/spawn_task` + `/build` | Yes |
| 5. Quality | `/review_code` + `/deep_code_audit` | No |
| 6. Docs | `/sync_docs` | No |
| 7. Finalize | — | No |

---

## Example Usage

**User Input:**
> "Build me a SaaS app for freelancers to track their projects and invoices. Use Next.js, Prisma, and Stripe."

**Orchestrator Execution:**
1. ✅ Phase 0: Parsed as "Web App, Next.js, MVP"
2. ✅ Phase 1: Genesis generated PRD with 6 MUS features
3. ✅ Phase 2: Design created 4 mockups
4. ✅ Phase 3: Scaffolded Next.js project
5. ✅ Phase 4 Wave 1: Auth + Database (sequential)
6. ✅ Phase 4 Wave 2: Projects, Invoices, Dashboard (parallel - 3 agents)
7. ✅ Phase 4 Wave 3: Stripe Integration (depends on Invoices)
8. ✅ Phase 5: Review passed, 2 P2 warnings logged
9. ✅ Phase 6: Docs synced
10. ✅ Phase 7: Handoff report generated

**Output:** Complete SaaS app ready for deployment.
