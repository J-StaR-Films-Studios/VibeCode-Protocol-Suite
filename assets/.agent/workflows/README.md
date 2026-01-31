---
description: A Detailed Explanation of what the vibe code protocol is
---

# VibeCode Workflow Guide

This document explains how all workflows in `.agent/workflows/` relate to each other, which ones are "parent" workflows, the recommended order of operations, and the relationship between **workflows** and **skills**.

---

## 📦 Workflows vs Skills

Understanding the difference:

| Type | Location | Invocation | Purpose |
|------|----------|------------|---------|
| **Workflow** | `.agent/workflows/*.md` | `/workflow-name` (slash command) | Step-by-step procedures the agent follows |
| **Skill** | `.agent/skills/*/SKILL.md` | Auto-loaded by context | Reusable protocols with scripts/templates |

**Why migrate to a skill?**
- Skills can include **scripts**, **templates**, and **resources**
- Skills are **portable** across projects (can be installed globally via `uipro`)
- Skills are **auto-loaded** when relevant context is detected

---

## Workflow Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         PROJECT LIFECYCLE (V3)                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  NEW PROJECT                         EXISTING PROJECT                        │
│       │                                    │                                 │
│       ▼                                    ▼                                 │
│  ╔═══════════════════════╗          /reverse_genesis                         │
│  ║ /init_vibecode_       ║                │                                  │
│  ║     genesis_v3        ║                │                                  │
│  ║                       ║                │                                  │
│  ║ • Creates PRD         ║                │                                  │
│  ║ • 1:1 FR↔Issues       ║                │                                  │
│  ║ • Copies templates    ║                │                                  │
│  ╚══════════╤════════════╝                │                                  │
│             ▼                             │                                  │
│  ┌───────────────────────┐                │                                  │
│  │ /vibe-design │ (Optional)     │                                  │
│  │ • Design system       │                │                                  │
│  │ • UI mockups          │                │                                  │
│  └───────────┬───────────┘                │                                  │
│              ▼                            │                                  │
│  ╔═══════════════════════╗                │                                  │
│  ║ /build_vibecode_      ║◄───────────────┘                                  │
│  ║     project_v3        ║                                                   │
│  ║                       ║                                                   │
│  ║ • Scaffolds project   ║                                                   │
│  ║ • tsc after EVERY edit║                                                   │
│  ║ • Marks FR progress   ║                                                   │
│  ╚══════════╤════════════╝                                                   │
│             │                                                                │
│             ▼                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    CONTINUATION LOOP (New Sessions)                     │  │
│  │                                                                         │  │
│  │   ╔═════════════════════╗      ╔═════════════════════╗                  │  │
│  │   ║   /vibe-continueBuild   ║─────►║   /vibe-finalize   ║                  │  │
│  │   ║                     ║      ║                     ║                  │  │
│  │   ║ • Context recovery  ║      ║ • Full verification ║                  │  │
│  │   ║ • Verify prev work  ║      ║ • Acceptance audit  ║                  │  │
│  │   ║ • Resume next FR    ║      ║ • Handoff report    ║                  │  │
│  │   ║ • tsc after edit    ║      ║                     ║                  │  │
│  │   ╚══════════╤══════════╝      ╚═════════════════════╝                  │  │
│  │              │                                                          │  │
│  │              └──────────────────┐                                       │  │
│  │                                 │ (repeat until all FRs done)           │  │
│  │              ┌──────────────────┘                                       │  │
│  │              ▼                                                          │  │
│  │   ┌─────────────────────────────────────────────────────────┐           │  │
│  │   │ IF AGENT MISBEHAVES:                                    │           │  │
│  │   │    /agent_reset ──► /vibe-primeAgent ──► resume work        │           │  │
│  │   └─────────────────────────────────────────────────────────┘           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                           VERIFICATION GATES                            │  │
│  │                                                                         │  │
│  │  After EVERY TypeScript/TSX edit:     npx tsc --noEmit                  │  │
│  │  Before handoff:                      python scripts/vibe-verify.py     │  │
│  │                                                                         │  │
│  │  ❌ If verification fails → STOP, fix, re-run, only then continue       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## V3 Workflow Lifecycle (RECOMMENDED)

```
/vibe-genesis    → Creates PRD, Issues (1 per FR), Guidelines template
         ↓
/vibe-design        → (Optional) Creates mockups
         ↓
/vibe-build   → Scaffolds, builds MUS with verification gates
         ↓
[New chat or continue]
         ↓
/vibe-continueBuild              → Picks up where last agent left off
         ↓
(repeat /vibe-continueBuild)
         ↓
/vibe-finalize              → Final verification, handoff report
```

**Key V3 Features:**
- `tsc --noEmit` after every file edit
- 1:1 FR↔Issue correlation
- Templates from `nextjs-standards` skill
- `vibe-verify.py` for verification

---

## Workflow Categories

### 🏗️ Project Initialization (Run Once)

| Workflow | Purpose | When to Use | Generates |
|----------|---------|-------------|-----------|
| `/vibe-genesis` | **V3 Architect** — Plans with templates | Starting new project | PRD, Issues (1 per FR), Guidelines template |
| `/vibe-design` | The Designer — Creates visual system | After Genesis, before Build | `docs/design/design-system.html`, `docs/mockups/*.html` |
| `/vibe-build` | **V3 Builder** — With verification gates | After Genesis (and optionally Design) | Project structure, MUS features with verification |
| `/vibe-continueBuild` | **Resume work** — Post-build sessions | New chat after initial build | Continues from incomplete FRs |
| `/vibe-finalize` | **Final handoff** — Verification + report | When MUS complete | `docs/Builder_Handoff_Report.md` |
| `/reverse_genesis` | Onboards to existing codebase | Joining an existing project | `docs/autopsy_report.md` |
| `/spawn-jstar-code-review` | Adds J-Star Reviewer to project | Any project needing code review | `.jstar/` directory, `.env.example` |

### 🎯 Mode Workflows (Specialized Roles)

Inspired by KiloCode's mode system, these workflows provide specialized capabilities:

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `/mode-orchestrator` | **Coordinate complex projects** — Delegate to sub-agents | Multi-step projects requiring coordination across domains |
| `/mode-architect` | **Plan and design** — Create technical specifications | Before implementation, designing systems, breaking down complex problems |
| `/mode-code` | **Write and refactor code** — Full implementation access | Implementing features, fixing bugs, creating files |
| `/mode-debug` | **Diagnose issues** — Systematic problem solving | Troubleshooting errors, investigating bugs, analyzing failures |
| `/mode-ask` | **Explain and analyze** — Answer questions without changes | Understanding concepts, analyzing code, getting recommendations |
| `/mode-review` | **Code review** — Quality assessment before commits | Reviewing changes, pre-commit checks, PR analysis |

**Mode Workflow Relationships:**
```
/mode-orchestrator ──► delegates to ──► /mode-architect, /mode-code, /mode-debug, /mode-review
     │
     └── monitors completion ◄─── .done files in docs/tasks/completed/

/mode-architect ──► designs ──► hands off to ──► /mode-code

/mode-code ──► implements ──► requests review ──► /mode-review

/mode-debug ──► investigates ──► hands off fix to ──► /mode-code

/mode-ask ──► analyzes ──► can switch to ──► /mode-code (if implementation needed)
```

### 🔄 Daily Development (Run Often)

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `/vibe-primeAgent` | Load project context | Start of session, before complex work |
| `/vibe-spawnTask` | Create detailed task prompt | Complex features needing breakdown |
| `/vibe-syncDocs` | Update feature documentation | After completing code changes |

### 🔍 Code Quality & Review

| Workflow | Purpose | When to Use | Requires |
|----------|---------|-------------|----------|
| `/mode-review_code` | Run J-Star review loop | Before commits, quality gates | **J-Star CLI** (`jstar` command) |
| `/mode-review` | Manual code review | Pre-commit review without J-Star | Nothing — pure AI review |

> [!TIP]
> For **deep security audits**, use the `security-audit` skill instead of searching for `/deep_code_audit`. See [Skill Migrations](#-skill-migrations) below.
> 
> For **manual code review** without J-Star CLI setup, use `/mode-review` mode workflow.

### 🆘 Recovery & Migration

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `/agent_reset` | Reset agent mid-conversation | Agent is hallucinating or stuck |
| `/escalate` | Generate handoff report | Agent is stuck, need fresh perspective |
| `/migrate` | Transfer context to new chat | Chat is stale, losing context |

---

## ⚠️ Important Clarifications

### `/smart_start` and `/smart_complete` — NOT Standalone Workflows

These are **shell script commands**, not slash-command workflows.

| What They Are | How to Use |
|---------------|------------|
| Commands from the **Smart Ops** system | Run via `./scripts/smart-ops.sh` or `.ps1` |
| Generated by `/init_smart_ops` | **Must run `/init_smart_ops` first** |
| GitHub-dependent | Requires `gh` CLI + authenticated repo |

**Setup Required:**
```bash
# Step 1: Initialize Smart Ops (generates the scripts)
/init_smart_ops

# Step 2: Use the commands
./scripts/smart-ops.sh start     # Start a task
./scripts/smart-ops.sh complete  # Complete a task
```

> [!IMPORTANT]
> If you haven't run `/init_smart_ops`, the commands `smart_start` and `smart_complete` will not exist.

### `/mode-review_code` vs Deep Security Audit

| Tool | Automation | When to Use | Requires |
|------|------------|-------------|----------|
| `/mode-review_code` | ✅ Automated (J-Star CLI) | Before commits, quick PR checks | `jstar` CLI installed |
| `security-audit` skill | ❌ Manual phases | Major releases, security reviews | Nothing — pure AI protocol |

**Use `/mode-review_code` for:**
- Daily commits
- PR quality gates
- Quick feedback loops

**Use `security-audit` skill for:**
- Before major releases
- Auditing auth/payment flows
- When manual logic probing is needed

---

## 🛠️ Skill Migrations

These workflows have been **migrated to skills** for better portability and added scripts/resources:

| Old Workflow (Legacy) | New Skill | Why Migrated |
|----------------------|-----------|--------------|
| `/analyze_component` | `component-analysis` | Better as protocol, no scripts needed |
| `/deep_code_audit` | `security-audit` | Manual protocol, no tooling dependency |
| `/git_worktree` | `git-worktree` | Reusable across projects |
| `/seo_ready` | `seo-ready` | Portable, includes templates |
| `/init_smart_ops` + `/smart_start` + `/smart_complete` | `github-ops` | Now includes `publish_issues.ps1` script |
| YouTube Phase 1-5 workflows | `youtube-pipeline` | Includes scripts + resources folder |

**To use migrated skills:**
```
# Skills are auto-loaded by context, but you can invoke directly:
User: "Audit this component for compliance"  → Loads component-analysis skill
User: "Run a security audit on this repo"    → Loads security-audit skill
User: "Set up git worktrees for parallel dev" → Loads git-worktree skill
```

---

## 📁 LEGACY Folder

The `LEGACY/` folder contains workflows that are:
1. **Superseded by V3 versions** (e.g., `build_vibecode_project.md` → `build_vibecode_project_v3.md`)
2. **Migrated to skills** (e.g., `deep_code_audit.md` → `security-audit` skill)
3. **Deprecated/Broken** (e.g., `vibe-orchestrator.md` — requires non-existent `vibecode` CLI)

| Legacy Workflow | Status | Replacement |
|-----------------|--------|-------------|
| `build_vibecode_project.md` | Superseded | `/vibe-build` |
| `build_vibecode_project_v2.md` | Superseded | `/vibe-build` |
| `init_vibecode_genesis_v1.md` | Superseded | `/vibe-genesis` |
| `analyze_component.md` | Migrated | `component-analysis` skill |
| `deep_code_audit.md` | Migrated | `security-audit` skill |
| `git_worktree.md` | Migrated | `git-worktree` skill |
| `seo_ready.md` | Migrated | `seo-ready` skill |
| `init_smart_ops.md` | Migrated | `github-ops` skill |
| `vibe-orchestrator.md` | ⚠️ Broken | Requires `vibecode` CLI that doesn't exist |
| `orchestrate.md` | ⚠️ Broken | Requires `vibecode` CLI that doesn't exist |
| `gemini-orchestrate.md` | ⚠️ Broken | Requires `vibecode` CLI that doesn't exist |
| `multi_agent_strategy.md` | Reference | Architecture docs only |
| YouTube Phase 1-5 workflows | Migrated | `youtube-pipeline` skill |

> [!CAUTION]
> **`vibe-orchestrator.md`** references a `vibecode spawn` CLI command that was never built. This workflow is **non-functional**. If you want autonomous multi-agent orchestration, it requires building the CLI first.

---

## Recommended Flows

### Flow 1: New Project (V3 - RECOMMENDED)

```
1. /vibe-genesis → Get PRD, Issues (1 per FR), Templates
2. /vibe-design     → Get design system, mockups (UI projects)
3. /vibe-build → Scaffold and build MUS with verification
4. /vibe-continueBuild           → Resume in new sessions
5. /vibe-finalize           → Final verification and handoff
6. /spawn-jstar-code-review  → Add code review tooling (optional)
```

### Flow 2: Joining Existing Project

```
1. /reverse_genesis          → Generate autopsy report
2. /vibe-primeAgent              → Load coding/styling context
3. Start working             → Reference the autopsy for architecture
```

### Flow 3: Daily Work Session

```
1. /vibe-primeAgent              → (Optional) Refresh context
2. ... do the work ...
3. /mode-review_code              → Check code quality before commit
4. git commit                → Commit clean code
```

### Flow 4: Complex Feature Implementation

```
1. /vibe-spawnTask               → Generate detailed task prompt
2. ... implement phases ...
3. /mode-review_code              → Quality gate before merge
4. /vibe-syncDocs                → Update feature documentation
```

### Flow 5: Agent Recovery

```
# If agent is stuck:
/escalate                    → Generate damage report for fresh agent

# If chat is stale:
/migrate                     → Generate state snapshot for new session

# If agent is hallucinating:
/agent_reset                 → Mid-conversation reset
```

### Flow 6: Code Review Loop (Quality Gate)

```
1. git add .                 → Stage changes
2. /mode-review_code              → Run J-Star review
3. Fix P0/P1 issues          → Address critical findings
4. Repeat until clean        → Max 3 loops
5. Commit                    → Code is ready
```

### Flow 7: Deep Security Audit

```
# Use the security-audit skill (auto-loaded when "security audit" mentioned)
1. Define scope (FULL/FEATURE/DIFF)
2. Phase 1: Static analysis (Detective)
3. Phase 2: Data flow tracing (Graph)
4. Phase 3: Spec vs Code (Auditor)
5. Phase 4: Logic probing (Judge)
6. Phase 5: Quality checks (Architect)
7. Generate report → .jstar/audit_report.md
8. Fix CRITICAL/HIGH issues
```

### Flow 8: Documentation Sync

```
1. Complete code changes     → Feature/fix is done
2. /vibe-syncDocs                → Identify impacted docs
3. UPDATE or CREATE          → Modify existing or add new doc
4. Follow template           → Consistent structure
5. Verify file paths         → Ensure links work
```

### Flow 9: Multi-Agent Orchestration (NEW)

For complex projects requiring coordination across multiple specialized agents:

```
1. /mode-orchestrator             → Break down project into subtasks
2. Create session folder       → docs/tasks/orchestrator-sessions/[ID]/
3. Create task files           → pending/01_subtask_name.task.md
4. Spawn sub-agents            → User opens new chats with task assignments
5. Sub-agents work             → Each completes their task, creates .result.md file
6. Review completions          → Return to orchestrator, review all .result.md files
7. Synthesize results          → Orchestrator creates summary report
8. Iterate if needed           → Create new tasks for remaining work
```

**Session ID Format:** `orch-YYYYMMDD-HHMMSS` (e.g., `orch-20250131-143022`)

**Task Folder Structure:**
```
docs/tasks/
└── orchestrator-sessions/           # All orchestrator sessions
    ├── orch-20250131-143022/       # Session 1 (timestamp-based ID)
    │   ├── master_plan.md          # Overview of all tasks
    │   ├── pending/                # Tasks waiting to start
    │   │   └── 01_genesis.task.md
    │   ├── in-progress/            # Tasks currently being worked on
    │   └── completed/              # Finished tasks with .result.md files
    │       ├── 01_genesis.result.md
    │       └── 02_design.result.md
    ├── orch-20250131-154511/       # Session 2
    └── ...
```

**Task File Naming Convention:**
- **Pending:** `01_subtask_name.task.md` (sequential number + descriptive name)
- **Completed:** `01_subtask_name.result.md` (same name, `.result.md` extension)

**Workflow:**
1. **Orchestrator** creates tasks in `pending/` with `.task.md` extension
2. **User** spawns sub-agents in new chats, assigning specific task files
3. **Sub-agents** work on tasks and create `.result.md` files in `completed/`
4. **Orchestrator** reviews all `.result.md` files and synthesizes results
5. **Iterate** if needed by creating new tasks

**Key Features:**
- **Isolation:** Each orchestrator session has its own folder
- **Continuity:** Easy to resume by referencing session ID
- **Organization:** All related tasks grouped under one session
- **Tracking:** `master_plan.md` shows progress across all tasks

---

## Parent-Child Relationships

### `/vibe-genesis` is Parent of:
- `/vibe-design` (uses the PRD)
- `/vibe-build` (uses PRD, Guidelines, Issues)

### `/vibe-build` is Parent of:
- `/vibe-continueBuild` (resumes incomplete FRs)
- `/vibe-finalize` (generates final handoff)

### `/vibe-continueBuild` Loops Into:
- Itself (repeat until all FRs done)
- `/vibe-finalize` (when MUS complete)

### `/spawn-jstar-code-review` Enables:
- `/mode-review_code` (requires J-Star to be set up)

### Standalone (No Parent):
- `/vibe-primeAgent` — Reload context anytime
- `/agent_reset` — Reset when agent misbehaves
- `/vibe-continueBuild` — Resume in any session
- `/vibe-spawnTask` — Break down complex features
- `/vibe-syncDocs` — Update documentation
- `/escalate` — Hand off to fresh agent
- `/migrate` — Move context to new session
- `/reverse_genesis` — Onboard to existing project

---

## Available Skills Reference

These skills are auto-loaded based on context. Location: `.agent/skills/`

| Skill | Description | Trigger Context |
|-------|-------------|-----------------|
| `code-review` | J-Star review on staged changes | "review code", before commits |
| `component-analysis` | Audit React/TS components | "analyze component", refactoring |
| `git-worktree` | Parallel agent development | "worktree", multi-agent |
| `github-ops` | Issue sync, projects, labels | GitHub automation, issue creation |
| `google-trends` | Automated trend research | YouTube research, topic validation |
| `nextjs-standards` | Coding standards + templates | Next.js projects (auto-detect) |
| `security-audit` | Deep manual security audit | Security review, major releases |
| `seo-ready` | SEO optimization for Next.js | SEO, metadata, sitemap |
| `spawn-task` | Generate detailed task prompts | Complex features |
| `sync-docs` | Update feature documentation | After code changes |
| `youtube-pipeline` | Full YouTube production pipeline | Video creation, scripting |
| `vercel-ai-sdk` | AI SDK patterns for Next.js | Building AI features |

---

## Quick Reference

| I want to... | Use this |
|--------------|----------|
| **Start a new project** | `/vibe-genesis` |
| **Design the UI** | `/vibe-design` |
| **Build the foundation** | `/vibe-build` |
| **Resume work (new session)** | `/vibe-continueBuild` |
| **Finish and hand off** | `/vibe-finalize` |
| **Coordinate multi-agent work** | `/mode-orchestrator` |
| **Plan before coding** | `/mode-architect` |
| **Implement features** | `/mode-code` |
| **Debug issues** | `/mode-debug` |
| **Ask questions** | `/mode-ask` |
| **Review code (manual)** | `/mode-review` |
| Join an existing project | `/reverse_genesis` |
| Reload agent context | `/vibe-primeAgent` |
| Reset misbehaving agent | `/agent_reset` |
| Break down a complex feature | `/vibe-spawnTask` |
| Run code review (J-Star) | `/mode-review_code` (requires J-Star) |
| Add code review tooling | `/spawn-jstar-code-review` |
| Deep security audit | Use `security-audit` skill |
| Analyze a component | Use `component-analysis` skill |
| SEO optimization | Use `seo-ready` skill |
| Set up parallel agents | Use `git-worktree` skill |
| Bulk sync GitHub issues | Use `github-ops` skill |
| Update documentation | `/vibe-syncDocs` |
| Hand off to fresh agent | `/escalate` |
| Move to new chat | `/migrate` |
| YouTube video pipeline | Use `youtube-pipeline` skill |
| Learn AI SDK patterns | `/Vercel Ai SDK` |

---

## Stack-Specific Notes

### Universal Shell Script (All Stacks)
The Smart Ops system (via `github-ops` skill) uses **shell scripts** that work with ANY project stack:

| Stack | Works? | Notes |
|-------|--------|-------|
| Node.js/TypeScript | ✅ | Shell script runs in any terminal |
| Python | ✅ | Shell script works |
| Rust | ✅ | Shell script works |
| Go | ✅ | Shell script works |
| Any Unix/Linux/macOS | ✅ | Native bash |
| Windows | ✅ | Git Bash, WSL, or PowerShell |

### J-Star Code Reviewer (All Languages)
The J-Star Reviewer works with **any programming language**:

| Language | Works? | Notes |
|----------|--------|-------|
| TypeScript/JavaScript | ✅ | Full support |
| Python | ✅ | Full support |
| Rust | ✅ | Full support |
| Go | ✅ | Full support |
| Any other | ✅ | Uses Gemini for analysis |

