# VibeCode Protocol Suite

<div align="center">
  <h3>🤖 A Complete System for AI-Human Software Development Collaboration</h3>
  <p><em>Code with the flow. Code with the vibe.</em></p>
</div>

---

## 🚀 Quick Start (Recommended)

Spawn the complete VibeCode system directly into your project with a single command:

```bash
# Using npx (No installation required)
npx vibesuite init

# Or using pnpm
pnpm dlx vibesuite init
```

This interactive CLI will let you choose exactly what you need:
- ✅ **.agent Folder** (For Cursor/Windsurf workflows)
- ✅ **Kilo Code Agents** (YAML definitions)
- ✅ **Legacy Protocols** (Manual prompts)
- ✅ **Select Specific Workflows/Skills**

---

## 📦 Install Skills (New Standard)

Use the new standard `skills` command to pull capabilities directly from the VibeCode Suite.

### Interactive Search & Install
```bash
# Using pnpm
pnpm dlx skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite

# Using npx
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite
```

### Core Essentials (Recommended)
Coding-focused skills for everyday development:
```bash
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite --skill ai-sdk --skill code-review --skill component-analysis --skill nextjs-standards --skill security-audit --skill spawn-task --skill stitch --skill sync-docs
```

### AI Media Suite (Paid / Advanced)
Specialized skills requiring API keys or paid services:
```bash
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite --skill ai-avatar-video --skill ai-marketing-videos --skill ai-podcast-creation --skill ai-product-photography --skill ai-social-media-content --skill ai-voice-cloning
```

### Full Standard Suite (Free)
Everything else (SEO, research, workflow tools):
```bash
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite --skill agent-recovery --skill algorithmic-art --skill audit-website --skill building-native-ui --skill code-review --skill component-analysis --skill context7 --skill copywriting --skill crafting-effective-readmes --skill docx --skill domain-name-brainstormer --skill frontend-design --skill gemini --skill git-worktree --skill github-ops --skill google-trends --skill high-fidelity-extraction --skill marketing-ideas --skill monorepo-management --skill nextjs-standards --skill pdf --skill pptx --skill pricing-strategy --skill programmatic-seo --skill prompt-engineering --skill remotion --skill security-audit --skill seo-ready --skill skill-creator --skill social-content --skill spawn-task --skill stitch --skill subagent-driven-development --skill sync-docs --skill twitter-automation --skill ui-ux-pro-max --skill upgrading-expo --skill webapp-testing --skill web-design-guidelines --skill xlsx --skill youtube-pipeline
```

---

## 🌟 What is VibeCode?

VibeCode isn't just a collection of prompts—it's a **complete workflow system** for collaborating with AI to build software. Think of yourself as the Visionary/CEO, and your AI assistants as a specialized, high-performance development team.

This repository contains the **VibeCode Protocol Suite**: a battle-tested collection of protocols, workflows, and prompts that transform AI from simple code generators into genuine project partners.

---

## 📂 Repository Structure

This repo is organized for **two types of users**:

| Folder | Purpose | Who It's For |
|--------|---------|--------------|
| **`.agent/`** | Workflows & Skills for agentic IDEs | Cursor, Windsurf, Gemini Code Assist users |
| **`Legacy (Manual Method)/`** | Copy-paste prompts & protocols | Browser-based AI users (ChatGPT, Claude.ai) |
| **`Deep_Source_Prompts/`** | Reference docs & source materials | Prompt engineers, contributors |

---

## 🤖 For Agentic IDE Users (Recommended)

**Using Cursor, Windsurf, VS Code + Gemini Code Assist, or similar?**  
Everything you need is in the **`.agent/`** folder.

### Quick Setup

1. Copy the `.agent/` folder to the root of your project
2. The IDE will automatically detect workflows and skills
3. Invoke workflows with slash commands (e.g., `/init_vibecode_genesis`)

### What's Inside `.agent/`

```
.agent/
├── workflows/          # Executable step-by-step workflows
│   ├── vibe-genesis.md         # Start new projects (V3)
│   ├── vibe-design.md          # Generate design systems
│   ├── vibe-build.md           # Execute the build
│   ├── vibe-continueBuild.md   # Resume work in new sessions
│   ├── vibe-finalize.md        # Final verification & handoff
│   ├── vibe-spawnTask.md       # Break down complex features
│   ├── vibe-syncDocs.md        # Update documentation
│   ├── vibe-primeAgent.md      # Load project context
│   ├── reverse_genesis.md      # Onboard to existing codebases
│   │
│   ├── mode-orchestrator.md    # Coordinate multi-agent projects
│   ├── mode-architect.md       # Plan and design systems
│   ├── mode-code.md            # Write and refactor code
│   ├── mode-debug.md           # Diagnose issues
│   ├── mode-ask.md             # Explain and analyze
│   ├── mode-review.md          # Code review (manual)
│   └── ...
│
└── skills/             # Implicit capabilities (auto-activated)
    ├── prime-agent/        # Load project context
    ├── code-review/        # J-Star code review loop
    ├── security-audit/     # Deep security analysis
    ├── nextjs-standards/   # Next.js coding standards
    ├── vercel-ai-sdk/      # AI SDK reference docs
    ├── youtube-pipeline/   # Video production workflow
    └── ...
```

### Key Workflows

#### 🏗️ Project Lifecycle (V3)
| Slash Command | What It Does |
|---------------|--------------|
| `/vibe-genesis` | Architect a new project with PRD, Issues, and Guidelines |
| `/vibe-design` | Generate design system and page mockups |
| `/vibe-build` | Scaffold and build the project with verification gates |
| `/vibe-continueBuild` | Resume work in a new chat session |
| `/vibe-finalize` | Final verification and handoff report |
| `/reverse_genesis` | Onboard AI to an existing codebase |

#### 🎯 Mode Workflows (Specialized Roles)
| Slash Command | What It Does |
|---------------|--------------|
| `/mode-orchestrator` | Coordinate complex multi-agent projects |
| `/mode-architect` | Plan and design technical systems |
| `/mode-code` | Write and refactor code |
| `/mode-debug` | Diagnose and troubleshoot issues |
| `/mode-ask` | Explain and analyze without making changes |
| `/mode-review` | Manual code review before commits |

#### 🔄 Daily Development
| Slash Command | What It Does |
|---------------|--------------|
| `/vibe-primeAgent` | Load project context at start of session |
| `/vibe-spawnTask` | Break down complex features into tasks |
| `/vibe-syncDocs` | Update documentation after code changes |
| `/mode-review_code` | Run J-Star automated code review |
| `/escalate` | Generate escalation report when stuck |
| `/migrate` | Transfer context to a new chat session |

---

## 📋 For Browser-Based AI Users

**Using ChatGPT, Claude.ai, or Gemini in the browser?**  
Use the **`Legacy (Manual Method)/`** folder with copy-paste prompts.

### The Protocol Library

| # | Protocol | Purpose |
|---|----------|---------|
| 0 | **VibeCode User Manual** | Complete guide to the system |
| 1 | **Project Genesis Protocol** | Start any new project (99% of cases) |
| 2 | **Ultimate Orchestration Prompt** | One-shot prompt for quick scripts |
| 3 | **Design System Genesis Protocol** | Create visual design systems |
| 4 | **GitHub Issue Meta-Prompt** | Structured issue creation |
| 5 | **Escalation & Handoff Protocol** | When AI gets stuck |
| 8 | **Seamless Migration Meta-Prompt** | Transfer context between sessions |
| 9 | **Reverse Genesis Protocol** | Onboard AI to existing codebases |

### How to Use

1. Open the relevant `.md` file from `Legacy (Manual Method)/`
2. Copy the entire prompt
3. Paste it into your AI chat interface
4. Follow the conversation flow

---

## 📚 Deep Source Prompts (For Contributors)

The **`Deep_Source_Prompts/`** folder contains the **reference documentation** and **source materials** used to create the workflows and protocols.

### Contents

- **Coding Guidelines** - React/TypeScript and Next.js App Router standards
- **Vercel AI SDK Docs** - Complete AI SDK reference (building RAG, streaming, tools)
- **Design System Docs** - Google's Material Design 3, mobile-first patterns
- **Agent Prompts** - Raw system prompts for various AI agents
- **OpenRouter Docs** - API reference for multi-model routing

> **Note:** These are raw, unprocessed reference materials. They're useful for understanding *why* the workflows are structured the way they are, or for creating new workflows.

---

## 🎯 The VibeCode Philosophy

- **Structured Collaboration**: Clear roles for different AI agents (Genesis, Designer, Builder, Orchestrator, Architect, Coder, Debugger)
- **End-to-End Workflows**: From project genesis to debugging escalations
- **Documentation-Driven**: Every project gets proper docs, issues, and roadmaps
- **Multi-Agent Orchestration**: Coordinate specialized agents for complex projects
- **Scalable**: Works for tiny scripts or enterprise applications

## 🆕 What's New (V3 + Mode Workflows)

### V3 Project Workflows
The V3 workflows introduce verification gates, TypeScript strict mode, and better continuation support:
- `tsc --noEmit` after every file edit
- 1:1 Feature Requirement ↔ Issue correlation
- Templates from `nextjs-standards` skill
- Seamless session continuation with `/vibe-continueBuild`

### Mode Workflows (KiloCode-Inspired)
New specialized mode workflows for targeted tasks:
- `/mode-orchestrator` - Coordinate multi-agent projects with session-based task management
- `/mode-architect` - Plan and design before coding
- `/mode-code` - Focused implementation mode
- `/mode-debug` - Systematic troubleshooting
- `/mode-ask` - Analysis without changes
- `/mode-review` - Quality assessment

### Naming Convention
- **`vibe-*`** workflows = Project lifecycle (genesis, design, build, continue, finalize)
- **`mode-*`** workflows = Specialized agent modes (orchestrator, architect, code, debug, ask, review)
- **Skills** = Reusable capabilities with auto-loading (in `.agent/skills/`)

---

## 👥 Your AI Team

### Project Workflows (Vibe Series)
| Role | Workflow | Responsibility | When to Use |
|------|----------|---------------|-------------|
| **Genesis** | `/vibe-genesis` | Strategic planning, PRD creation, issue generation | Starting new projects |
| **Designer** | `/vibe-design` | Visual design systems, UI mockups | Before implementation |
| **Builder** | `/vibe-build` | Initial code implementation with verification | Building the foundation |
| **Continuer** | `/vibe-continueBuild` | Resume work in new sessions | Continuing after breaks |
| **Finalizer** | `/vibe-finalize` | Verification, handoff reports | Project completion |

### Mode Workflows (Specialized Modes)
| Role | Workflow | Responsibility | When to Use |
|------|----------|---------------|-------------|
| **Orchestrator** | `/mode-orchestrator` | Coordinate multi-agent projects, delegate tasks | Complex projects requiring coordination |
| **Architect** | `/mode-architect` | Technical planning, system design | Before coding complex features |
| **Coder** | `/mode-code` | Write, refactor, implement code | Day-to-day coding tasks |
| **Debugger** | `/mode-debug` | Systematic issue diagnosis | When bugs are hard to find |
| **Analyst** | `/mode-ask` | Explain, analyze, recommend | Understanding code without changes |
| **Reviewer** | `/mode-review` | Code quality assessment | Pre-commit quality gates |

---

## 🚀 Quick Start Guide

### For Agentic IDE Users
```bash
# 1. Copy .agent folder to your project root
cp -r path/to/VibeCode-Protocol-Suite/.agent ./

# 2. Start a new project (V3 Workflow)
# Type: /vibe-genesis

# 3. Generate design system
# Type: /vibe-design

# 4. Build the project
# Type: /vibe-build

# 5. Continue in new sessions
# Type: /vibe-continueBuild

# 6. Finalize and handoff
# Type: /vibe-finalize
```

### For Complex Multi-Agent Projects
```bash
# Use the orchestrator to coordinate multiple specialized agents
# Type: /mode-orchestrator

# The orchestrator will:
# 1. Break down your project into subtasks
# 2. Create task files in docs/tasks/orchestrator-sessions/[ID]/
# 3. Guide you to spawn sub-agents for each task
# 4. Track completion and synthesize results
```

### For Browser AI Users
```bash
# 1. Open: Legacy (Manual Method)/1 Project Genesis Protocol The VibeCode Workflow.md
# 2. Copy the entire content
# 3. Paste into ChatGPT/Claude/Gemini
# 4. Follow the conversation flow
```

---

## 🤝 Contributing

This is a living system! If you discover improvements:

1. Test your changes with real projects
2. Add reference materials to `Deep_Source_Prompts/` if needed
3. Create workflows in `.agent/workflows/` for agentic IDEs
4. Update legacy prompts in `Legacy (Manual Method)/` for browser users
5. Create a GitHub Issue with your proposed changes

---

## 🙏 Acknowledgements

- **Anthropic Skills**: From [anthropics/skills](https://github.com/anthropics/skills) — a massive collection including **Office Suite** (PDF/DOCX/PPTX/XLSX), **Frontend Design**, **Webapp Testing**, **Algorithmic Art**, **Monorepo Management**, and **Skill Creator**.
- **Inference.sh Skills**: From [inference.sh/skills](https://github.com/inference-sh/skills) — complete media & automation suite including **Marketing Videos**, **Voice Cloning**, **Social Content**, **Twitter Automation**, **Product Photography**, and **Prompt Engineering**.
- **Marketing Skills**: From [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) — the complete marketer's toolkit: **Copywriting**, **Pricing Strategy**, **Social Strategy**, **Programmatic SEO**, and **Marketing Ideas**.
- **Expo Skills**: From [Expo](https://github.com/expo/skills) — **Building Native UI** (React Native/Expo Router) and **Upgrading Expo** guide.
- **Vercel AI SDK**: From [vercel/ai](https://github.com/vercel/ai) — **AI SDK** reference and **Web Design Guidelines**.
- **UI/UX Pro Max**: From [Next Level Builder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — premium design intelligence.
- **Remotion**: From [Remotion](https://github.com/remotion-dev/skills) — programmatic video creation.
- **Subagent Development**: From [obra/superpowers](https://github.com/obra/superpowers) — advanced implementation planning.
- **Context7**: From [upstash/context7](https://github.com/upstash/context7) — fresh library documentation fetcher.
- **Audit Website**: From [squirrelscan/skills](https://github.com/squirrelscan/skills) — professional website auditor.
- **Gemini CLI**: Custom VibeCode skill for large-context processing with Gemini 3 Pro.
- **Google Stitch Skills**: From [google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills) — Design-to-code suite including **design-md**, **enhance-prompt**, **stitch-loop**, **react-components**, and **shadcn-ui**.

## 📄 License

This repository contains workflow protocols and prompts. Feel free to use, modify, and share. The goal is to improve AI-human collaboration for everyone.

---

<div align="center">
  <p><strong>Built with ❤️ for developers who want to code with the flow</strong></p>
  <p><em>Transform AI from a tool into a true development partner</em></p>
</div>
