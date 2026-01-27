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
│  │ /init_vibecode_design │ (Optional)     │                                  │
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
│  │   ║   /continue_build   ║─────►║   /finalize_build   ║                  │  │
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
│  │   │    /agent_reset ──► /prime_agent ──► resume work        │           │  │
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
/init_vibecode_genesis_v3    → Creates PRD, Issues (1 per FR), Guidelines template
         ↓
/init_vibecode_design        → (Optional) Creates mockups
         ↓
/build_vibecode_project_v3   → Scaffolds, builds MUS with verification gates
         ↓
[New chat or continue]
         ↓
/continue_build              → Picks up where last agent left off
         ↓
(repeat /continue_build)
         ↓
/finalize_build              → Final verification, handoff report
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
| `/init_vibecode_genesis_v3` | **V3 Architect** — Plans with templates | Starting new project | PRD, Issues (1 per FR), Guidelines template |
| `/init_vibecode_design` | The Designer — Creates visual system | After Genesis, before Build | `docs/design/design-system.html`, `docs/mockups/*.html` |
| `/build_vibecode_project_v3` | **V3 Builder** — With verification gates | After Genesis (and optionally Design) | Project structure, MUS features with verification |
| `/continue_build` | **Resume work** — Post-build sessions | New chat after initial build | Continues from incomplete FRs |
| `/finalize_build` | **Final handoff** — Verification + report | When MUS complete | `docs/Builder_Handoff_Report.md` |
| `/reverse_genesis` | Onboards to existing codebase | Joining an existing project | `docs/autopsy_report.md` |
| `/spawn-jstar-code-review` | Adds J-Star Reviewer to project | Any project needing code review | `.jstar/` directory, `.env.example` |

### 🔄 Daily Development (Run Often)

| Workflow | Purpose | When to Use |
|----------|---------|-------------|
| `/prime_agent` | Load project context | Start of session, before complex work |
| `/spawn_task` | Create detailed task prompt | Complex features needing breakdown |
| `/sync_docs` | Update feature documentation | After completing code changes |

### 🔍 Code Quality & Review

| Workflow | Purpose | When to Use | Requires |
|----------|---------|-------------|----------|
| `/review_code` | Run J-Star review loop | Before commits, quality gates | **J-Star CLI** (`jstar` command) |

> [!TIP]
> For **deep security audits**, use the `security-audit` skill instead of searching for `/deep_code_audit`. See [Skill Migrations](#-skill-migrations) below.

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

### `/review_code` vs Deep Security Audit

| Tool | Automation | When to Use | Requires |
|------|------------|-------------|----------|
| `/review_code` | ✅ Automated (J-Star CLI) | Before commits, quick PR checks | `jstar` CLI installed |
| `security-audit` skill | ❌ Manual phases | Major releases, security reviews | Nothing — pure AI protocol |

**Use `/review_code` for:**
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
| `build_vibecode_project.md` | Superseded | `/build_vibecode_project_v3` |
| `build_vibecode_project_v2.md` | Superseded | `/build_vibecode_project_v3` |
| `init_vibecode_genesis_v1.md` | Superseded | `/init_vibecode_genesis_v3` |
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
1. /init_vibecode_genesis_v3 → Get PRD, Issues (1 per FR), Templates
2. /init_vibecode_design     → Get design system, mockups (UI projects)
3. /build_vibecode_project_v3 → Scaffold and build MUS with verification
4. /continue_build           → Resume in new sessions
5. /finalize_build           → Final verification and handoff
6. /spawn-jstar-code-review  → Add code review tooling (optional)
```

### Flow 2: Joining Existing Project

```
1. /reverse_genesis          → Generate autopsy report
2. /prime_agent              → Load coding/styling context
3. Start working             → Reference the autopsy for architecture
```

### Flow 3: Daily Work Session

```
1. /prime_agent              → (Optional) Refresh context
2. ... do the work ...
3. /review_code              → Check code quality before commit
4. git commit                → Commit clean code
```

### Flow 4: Complex Feature Implementation

```
1. /spawn_task               → Generate detailed task prompt
2. ... implement phases ...
3. /review_code              → Quality gate before merge
4. /sync_docs                → Update feature documentation
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
2. /review_code              → Run J-Star review
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
2. /sync_docs                → Identify impacted docs
3. UPDATE or CREATE          → Modify existing or add new doc
4. Follow template           → Consistent structure
5. Verify file paths         → Ensure links work
```

---

## Parent-Child Relationships

### `/init_vibecode_genesis_v3` is Parent of:
- `/init_vibecode_design` (uses the PRD)
- `/build_vibecode_project_v3` (uses PRD, Guidelines, Issues)

### `/build_vibecode_project_v3` is Parent of:
- `/continue_build` (resumes incomplete FRs)
- `/finalize_build` (generates final handoff)

### `/continue_build` Loops Into:
- Itself (repeat until all FRs done)
- `/finalize_build` (when MUS complete)

### `/spawn-jstar-code-review` Enables:
- `/review_code` (requires J-Star to be set up)

### Standalone (No Parent):
- `/prime_agent` — Reload context anytime
- `/agent_reset` — Reset when agent misbehaves
- `/continue_build` — Resume in any session
- `/spawn_task` — Break down complex features
- `/sync_docs` — Update documentation
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
| **Start a new project** | `/init_vibecode_genesis_v3` |
| **Design the UI** | `/init_vibecode_design` |
| **Build the foundation** | `/build_vibecode_project_v3` |
| **Resume work (new session)** | `/continue_build` |
| **Finish and hand off** | `/finalize_build` |
| Join an existing project | `/reverse_genesis` |
| Reload agent context | `/prime_agent` |
| Reset misbehaving agent | `/agent_reset` |
| Break down a complex feature | `/spawn_task` |
| Run code review | `/review_code` (requires J-Star) |
| Add code review tooling | `/spawn-jstar-code-review` |
| Deep security audit | Use `security-audit` skill |
| Analyze a component | Use `component-analysis` skill |
| SEO optimization | Use `seo-ready` skill |
| Set up parallel agents | Use `git-worktree` skill |
| Bulk sync GitHub issues | Use `github-ops` skill |
| Update documentation | `/sync_docs` |
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
