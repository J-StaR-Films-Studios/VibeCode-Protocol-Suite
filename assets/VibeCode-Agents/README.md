# VibeCode Agents for Kilo Code

A collection of **13 specialized AI agents** designed to work together as an autonomous development system.

## Quick Start

### Importing Agents

1. Open **Kilo Code** settings
2. Navigate to **Custom Modes**
3. Click **Import from YAML**
4. Select any `.yaml` file from this directory

### Recommended Import Order

Start with core agents, then add as needed:

```
1. vibe-orchestrator    (The Brain - coordinates everything)
2. vibe-architect       (Planning - creates PRD & guidelines)
3. vibe-builder         (Implementation - writes code)
4. vibe-reviewer        (Quality - J-Star code review)
```

---

## Agent Arsenal

### Wave 1: Core Orchestration

| Agent | Slug | Purpose |
|-------|------|---------|
| **VibeCode Brain** | `vibe-orchestrator` | Master orchestrator - coordinates all agents, manages parallel execution |
| **VibeCode Architect** | `vibe-architect` | Genesis planning - creates PRD, coding guidelines, builder prompts |
| **VibeCode Builder** | `vibe-builder` | Implementation - transforms blueprints into production code |

### Wave 2: Quality & Security

| Agent | Slug | Purpose |
|-------|------|---------|
| **VibeCode Reviewer** | `vibe-reviewer` | Code review using J-Star pipeline with fix loops |
| **VibeCode Auditor** | `vibe-auditor` | Deep security & logic audit beyond automated tools |

### Wave 3: Design & Tasks

| Agent | Slug | Purpose |
|-------|------|---------|
| **VibeCode Designer** | `vibe-designer` | Design systems, mockups, visual identity |
| **VibeCode Spawner** | `vibe-spawner` | Task breakdown into executable prompts |
| **VibeCode Onboarder** | `vibe-onboarder` | Codebase analysis & autopsy reports |

### Wave 4: Utilities

| Agent | Slug | Purpose |
|-------|------|---------|
| **VibeCode Documentor** | `vibe-documentor` | Keep docs in sync with code |
| **VibeCode Primer** | `vibe-primer` | Load project context before work |
| **VibeCode Analyzer** | `vibe-analyzer` | Component quality analysis |
| **VibeCode Escalator** | `vibe-escalator` | Generate handoff reports when stuck |
| **VibeCode Isolator** | `vibe-isolator` | Git worktree management for parallel dev |

---

## Common Workflows

### New Project (Full Pipeline)
```
vibe-architect  →  vibe-designer  →  vibe-builder  →  vibe-reviewer
   (Plan)            (Design)         (Build)          (Review)
```

### Existing Project (Feature Addition)
```
vibe-onboarder  →  vibe-spawner  →  vibe-builder  →  vibe-reviewer
  (Understand)       (Plan)          (Build)         (Review)
```

### Parallel Development
```
vibe-orchestrator
       ↓
  vibe-isolator (creates worktrees)
       ↓
  [User spawns agents in each worktree]
       ↓
  vibe-orchestrator (merges results)
```

### When Stuck
```
vibe-escalator  →  [New session with report]  →  vibe-builder
   (Document)              (Fresh agent)            (Fix)
```

---

## Agent Communication Pattern

The orchestrator uses a **user handoff** pattern for parallel work:

1. **Orchestrator prepares** task prompts + worktrees
2. **Orchestrator pauses** and informs user what to do
3. **User spawns** agents in each worktree IDE
4. **User signals** "ready to merge" when all complete
5. **Orchestrator resumes** to merge and continue

This works around the limitation that a single agent can't open multiple IDEs.

---

## File Structure

```
docs/VibeCode-Agents/
├── vibe-orchestrator.yaml     # The Brain
├── vibe-architect.yaml        # Planning
├── vibe-builder.yaml          # Implementation
├── vibe-reviewer.yaml         # Code Review
├── vibe-auditor.yaml          # Security Audit
├── vibe-designer.yaml         # UI Design
├── vibe-spawner.yaml          # Task Breakdown
├── vibe-onboarder.yaml        # Codebase Analysis
├── vibe-documentor.yaml       # Doc Sync
├── vibe-primer.yaml           # Context Loading
├── vibe-analyzer.yaml         # Component Audit
├── vibe-escalator.yaml        # Error Handoff
├── vibe-isolator.yaml         # Git Worktrees
└── README.md                  # This file
```

---

## Tips

- **Start small**: Test with `vibe-architect` → `vibe-builder` on a simple project
- **Trust the prompts**: Each agent has detailed instructions—let them work
- **Use the handoff**: For parallel work, the orchestrator will tell you exactly what to do
- **Escalate early**: If an agent is stuck for 3+ attempts, switch to `vibe-escalator`

---

*Built with the VibeCode Protocol • Autonomous development, human oversight*
