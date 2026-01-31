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
│   ├── init_vibecode_genesis.md    # Start new projects
│   ├── init_vibecode_design.md     # Generate design systems
│   ├── build_vibecode_project.md   # Execute the build
│   ├── reverse_genesis.md          # Onboard to existing codebases
│   ├── orchestrate.md              # Parallel agent orchestration
│   └── ...
│
└── skills/             # Implicit capabilities (auto-activated)
    ├── prime-agent/        # Load project context
    ├── code-review/        # J-Star code review loop
    ├── security-audit/     # Deep security analysis
    ├── vercel-ai-sdk/      # AI SDK reference docs
    ├── youtube-pipeline/   # Video production workflow
    └── ...
```

### Key Workflows

| Slash Command | What It Does |
|---------------|--------------|
| `/init_vibecode_genesis` | Architect a new project with plans, docs, and roadmap |
| `/init_vibecode_design` | Generate design system and page mockups |
| `/build_vibecode_project_v2` | Scaffold and build the project (pnpm/PowerShell safe) |
| `/reverse_genesis` | Onboard AI to an existing codebase |
| `/orchestrate` | Autonomous multi-agent project builder |
| `/vibe-orchestrator` | Master brain protocol for complex orchestration |
| `/review_code` | Run J-Star code review loop |
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

- **Structured Collaboration**: Clear roles for different AI agents (Orchestrator, Builder, In-IDE Assistant, Design Agent)
- **End-to-End Workflows**: From project genesis to debugging escalations
- **Documentation-Driven**: Every project gets proper docs, issues, and roadmaps
- **Scalable**: Works for tiny scripts or enterprise applications

---

## 👥 Your AI Team

| Role | Responsibility | When to Use |
|------|---------------|-------------|
| **AI Orchestrator** | Strategic planning, architecture, documentation | Project planning, debugging complex issues |
| **Builder Agent** | Initial code implementation | Taking Orchestrator plans and building the foundation |
| **In-IDE Assistant** | Tactical coding, refactoring | Writing functions, fixing bugs in existing code |
| **Design Agent** | Visual design, UI/UX | Creating mockups, design systems |

---

## 🚀 Quick Start Guide

### For Agentic IDE Users
```bash
# 1. Copy .agent folder to your project root
cp -r path/to/VibeCode-Protocol-Suite/.agent ./

# 2. Start a new project
# Type: /init_vibecode_genesis

# 3. Generate design system
# Type: /init_vibecode_design

# 4. Build the project
# Type: /build_vibecode_project_v2
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

- **UI/UX Pro Max Skill**: Shoutout to [Next Level Builder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) for the incredible UI/UX skill. We've integrated it directly into VibeSuite to bring premium design intelligence to your workflows.
- **Remotion Skill**: Official skill from [Remotion](https://github.com/remotion-dev/skills/tree/main/skills/remotion) for programmatic video creation in React.

## 📄 License

This repository contains workflow protocols and prompts. Feel free to use, modify, and share. The goal is to improve AI-human collaboration for everyone.

---

<div align="center">
  <p><strong>Built with ❤️ for developers who want to code with the flow</strong></p>
  <p><em>Transform AI from a tool into a true development partner</em></p>
</div>
