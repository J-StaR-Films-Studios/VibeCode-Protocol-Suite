---
description: A Detailed Explanation of what the vibe code protocol is
---

# VibeCode Workflow Guide

This document explains how all workflows in `.agent/workflows/` relate to each other, which ones are "parent" workflows, and the recommended order of operations.

---

## Workflow Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           PROJECT LIFECYCLE                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  🧠 /ORCHESTRATE — THE BRAIN (Autonomous Mode)                          │ │
│  │  Understands all workflows. Spawns sub-agents. Builds full projects.    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│              ┌───────────────┴───────────────┐                               │
│              ▼                               ▼                               │
│  NEW PROJECT                         EXISTING PROJECT                        │
│       │                                    │                                 │
│       ▼                                    ▼                                 │
│  /init_vibecode_genesis ──────────►  /reverse_genesis                        │
│       │                                    │                                 │
│       ▼                                    │                                 │
│  /init_vibecode_design                     │                                 │
│       │                                    │                                 │
│       ▼                                    │                                 │
│  /build_vibecode_project ◄─────────────────┘                                 │
│       │                                                                      │
│       ├───► /init_smart_ops (bootstraps smart_start/complete)                │
│       │                                                                      │
│       ├───► /spawn-jstar-code-review (adds J-Star Reviewer)                  │
│       │                                                                      │
│       ▼                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      DAILY DEVELOPMENT LOOP                             │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │ /prime_agent ──► /smart_start ──► WORK ──► /smart_complete       │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                            │                                            │  │
│  │                            ▼                                            │  │
│  │           /spawn_task (for complex features)                            │  │
│  │           /analyze_component (for refactoring)                          │  │
│  │           /review_code (for quality gates)                              │  │
│  │           /sync_docs (keep docs updated)                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  PARALLEL DEVELOPMENT             QUALITY ASSURANCE                          │
│       │                                 │                                    │
│       ▼                                 ▼                                    │
│  /git_worktree ◄──────────────►  /deep_code_audit                            │
│       │                                 │                                    │
│       ▼                                 ▼                                    │
│  /orchestrate ◄───────────────►  /review_code                                │
│                                                                              │
│  WHEN STUCK                       WHEN CHAT GETS STALE                       │
│       │                                 │                                    │
│       ▼                                 ▼                                    │
│  /escalate                         /migrate                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Workflow Categories

### 🏗️ Project Initialization (Run Once)

| Workflow | Purpose | When to Use | Generates |
|----------|---------|-------------|-----------|
| `/init_vibecode_genesis` | The Architect — Plans a new project | Starting a brand new project | `docs/Project_Requirements.md`, `docs/Coding_Guidelines.md`, `docs/Builder_Prompt.md`, GitHub Issues |
| `/init_vibecode_design` | The Designer — Creates visual system | After Genesis, before Build | `docs/design/design-system.html`, `docs/mockups/*.html` |
| `/build_vibecode_project` | The Builder — Scaffolds and builds | After Genesis (and optionally Design) | Project structure, MUS features, `docs/Builder_Handoff_Report.md` |
| `/build_vibecode_project_v2` | The Builder v2 — pnpm + PowerShell safe | Same as above, Windows-optimized | Same as above |
| `/init_smart_ops` | Bootstraps GitHub integration | After Build, when project has `src/` | `src/scripts/smart-ops.ts`, `smart_start.md`, `smart_complete.md` |
| `/reverse_genesis` | Onboards to existing codebase | Joining an existing project | `docs/autopsy_report.md` |
| `/spawn-jstar-code-review` | Adds J-Star Reviewer to project | Any project needing code review | `.jstar/` directory, `.env.example` |

### 🔄 Daily Development (Run Often)

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `/prime_agent` | Load project context | Start of session, before complex work |
| `/smart_start` | Start work on a feature/bug | Beginning any task |
| `/smart_complete` | Mark work as done | Finishing any task |
| `/spawn_task` | Create detailed task prompt | Complex features needing breakdown |
| `/analyze_component` | Audit component quality | Refactoring, code review |
| `/sync_docs` | Update feature documentation | After completing code changes |

### 🔍 Code Quality & Review

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `/review_code` | Run J-Star review loop | Before commits, quality gates |
| `/deep_code_audit` | Manual security & logic audit | Major releases, security review |
| `/Vercel Ai SDK` | Learn AI SDK patterns | Building AI-powered features |

### 🔀 Parallel Development (Multi-Agent)

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `/git_worktree` | Manage isolated dev environments | Multiple agents on same repo |
| `/orchestrate` | **The Brain** — Autonomous full project builds | Kilo Code, automated pipelines |
| `/multi_agent_strategy` | Architecture docs for multi-agent | Planning parallel execution |

### 🆘 Recovery & Migration

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `/escalate` | Generate handoff report | Agent is stuck, need fresh perspective |
| `/migrate` | Transfer context to new chat | Chat is stale, losing context |

---

## Recommended Flows

### Flow 1: New Project (Full VibeCode)

```
1. /init_vibecode_genesis    → Get PRD, Guidelines, Issues
2. /init_vibecode_design     → Get design system, mockups (UI projects)
3. /build_vibecode_project   → Scaffold and build MUS
4. /spawn-jstar-code-review  → Add code review tooling
5. /init_smart_ops           → Set up GitHub automation
6. /prime_agent              → Start daily work loop
```

### Flow 2: Joining Existing Project

```
1. /reverse_genesis          → Generate autopsy report
2. /prime_agent              → Load coding/styling context
3. /smart_start              → Pick up first task
```

### Flow 3: Daily Work Session

```
1. /prime_agent              → (Optional) Refresh context
2. /smart_start              → Declare what you're working on
3. ... do the work ...
4. /review_code              → Check code quality before commit
5. /smart_complete           → Close out the task
```

### Flow 4: Complex Feature Implementation

```
1. /spawn_task               → Generate detailed task prompt
2. /smart_start              → Link to GitHub issue
3. ... implement phases ...
4. /analyze_component        → Audit any large components
5. /review_code              → Quality gate before merge
6. /sync_docs                → Update feature documentation
7. /smart_complete           → Mark as done
```

### Flow 5: Agent Recovery

```
# If agent is stuck:
/escalate                    → Generate damage report for fresh agent

# If chat is stale:
/migrate                     → Generate state snapshot for new session
```

### Flow 6: Code Review Loop (Quality Gate)

```
1. git add .                 → Stage changes
2. /review_code              → Run J-Star review
3. Fix P0/P1 issues          → Address critical findings
4. Repeat until clean        → Max 3 loops
5. Commit                    → Code is ready
```

### Flow 7: Deep Security Audit

```
1. /deep_code_audit          → Full manual audit
2. Define scope (FULL/FEATURE/DIFF)
3. Phase 1: Static analysis (Detective)
4. Phase 2: Data flow tracing (Graph)
5. Phase 3: Spec vs Code (Auditor)
6. Phase 4: Logic probing (Judge)
7. Phase 5: Quality checks (Architect)
8. Generate report → .jstar/audit_report.md
9. Fix CRITICAL/HIGH issues
```

### Flow 8: Parallel Development (Multi-Agent)

```
1. /git_worktree             → Choose [NEW] to create agent environment
2. Name the agent            → e.g., "feat-auth", "agent-2"
3. Copy .env + DB            → Migrate context to worktree
4. pnpm install              → Bootstrap dependencies
5. Work in isolation         → Each agent has own directory
6. /review_code              → Quality check in worktree
7. Merge to main             → Via PR or direct merge
8. /git_worktree             → Choose [KILL] to teardown
```

### Flow 9: Documentation Sync

```
1. Complete code changes     → Feature/fix is done
2. /sync_docs                → Identify impacted docs
3. UPDATE or CREATE          → Modify existing or add new doc
4. Follow template           → Consistent structure
5. Verify file paths         → Ensure links work
```

---

## Parent-Child Relationships

### `/init_vibecode_genesis` is Parent of:
- `/init_vibecode_design` (uses the PRD)
- `/build_vibecode_project` (uses PRD, Guidelines, Builder Prompt)

### `/build_vibecode_project` is Parent of:
- `/init_smart_ops` (needs `src/` to exist)
- `/spawn-jstar-code-review` (needs project structure)

### `/init_smart_ops` Generates:
- `/smart_start` (the actual workflow used daily)
- `/smart_complete` (the actual workflow used daily)

### `/spawn-jstar-code-review` Enables:
- `/review_code` (requires J-Star to be set up)

### `/git_worktree` Enables:
- `/multi_agent_strategy` (parallel execution depends on isolation)

### Standalone (No Parent):
- `/prime_agent` — Can run anytime
- `/analyze_component` — Can run anytime
- `/spawn_task` — Can run anytime
- `/deep_code_audit` — Can run anytime
- `/sync_docs` — Can run anytime
- `/escalate` — Run when stuck
- `/migrate` — Run when chat stale
- `/reverse_genesis` — Alternative to Genesis for existing projects
- `/Vercel Ai SDK` — Reference documentation

---

## Stack-Specific Notes

### Universal Shell Script (All Stacks)
The Smart Ops system now uses a **universal shell script** (`scripts/smart-ops.sh`) that works with ANY project stack:

| Stack | Works? | Notes |
|-------|--------|-------|
| Node.js/TypeScript | ✅ | Shell script runs in any terminal |
| Python | ✅ | Shell script works |
| Rust | ✅ | Shell script works |
| Go | ✅ | Shell script works |
| Any Unix/Linux/macOS | ✅ | Native bash |
| Windows | ✅ | Git Bash, WSL, or PowerShell with bash |

### J-Star Code Reviewer (All Languages)
The J-Star Reviewer works with **any programming language**:

| Language | Works? | Notes |
|----------|--------|-------|
| TypeScript/JavaScript | ✅ | Full support |
| Python | ✅ | Full support |
| Rust | ✅ | Full support |
| Go | ✅ | Full support |
| Any other | ✅ | Uses Gemini for analysis |

---

## Timeline Tracking (GitHub Projects)

The Smart Ops system supports **timeline tracking** for GitHub Projects:

### Features:
- **Start Date** — Automatically set when moving to "In Progress"
- **Target Date** — Set when creating issues (based on estimate)
- **Duration Tracking** — Calculate actual vs estimated time on completion
- **Timeline View** — View in GitHub Projects Roadmap/Timeline

### Setup:
1. In your GitHub Project, create these fields:
   - "Start Date" (Date type)
   - "Target Date" (Date type)
2. Run `/init_smart_ops` to detect field IDs
3. The script will auto-populate dates

### Workflow:
```
/smart_start → "How long will this take?" → Sets target date
... work ...
/smart_complete → Calculates actual duration → Reports variance
```

### Commands:
```bash
# Create issue with 7-day estimate
./scripts/smart-ops.sh create "Fix login" "Description" "bug" 7

# Set target date manually
./scripts/smart-ops.sh target <item_id> 14           # 14 days from now
./scripts/smart-ops.sh target <item_id> 2024-12-25   # Specific date

# Set start date
./scripts/smart-ops.sh started <item_id>              # Today
./scripts/smart-ops.sh started <item_id> 2024-12-10  # Specific date
```

---

## Quick Reference

| I want to... | Use this workflow |
|--------------|-------------------|
| Start a new project | `/init_vibecode_genesis` |
| Design the UI | `/init_vibecode_design` |
| Build the foundation | `/build_vibecode_project` |
| Add code review tooling | `/spawn-jstar-code-review` |
| Set up GitHub automation | `/init_smart_ops` |
| Join an existing project | `/reverse_genesis` |
| Brief the agent on rules | `/prime_agent` |
| Start a work session | `/smart_start` |
| End a work session | `/smart_complete` |
| Break down a complex feature | `/spawn_task` |
| Audit a component | `/analyze_component` |
| Run code review | `/review_code` |
| Deep security audit | `/deep_code_audit` |
| Update documentation | `/sync_docs` |
| Set up parallel agents | `/git_worktree` |
| **Build full project autonomously** | `/orchestrate` |
| Plan multi-agent architecture | `/multi_agent_strategy` |
| Hand off to fresh agent | `/escalate` |
| Move to new chat | `/migrate` |
| Learn AI SDK patterns | `/Vercel Ai SDK` |
| Set issue target date | `./scripts/smart-ops.sh target` |
| Track work duration | `/smart_complete` (auto) |
