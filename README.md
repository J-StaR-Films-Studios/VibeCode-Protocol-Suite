# Takomi

<div align="center">
  <h3>🎯 Stop Wrestling With AI. Start Building With Purpose.</h3>
  <p><em>The artisan's toolkit that transforms AI from chatbot to development partner</em></p>

  [![npm version](https://img.shields.io/npm/v/takomi?color=%23cb3837&label=npm)](https://www.npmjs.com/package/takomi)
  [![npm downloads](https://img.shields.io/npm/dm/takomi?color=%232b8a3e&label=downloads)](https://www.npmjs.com/package/takomi)
  [![GitHub stars](https://img.shields.io/github/stars/JStaRFilms/VibeCode-Protocol-Suite?style=flat&color=%23e3b341&label=stars)](https://github.com/JStaRFilms/VibeCode-Protocol-Suite)
  [![License: ISC](https://img.shields.io/npm/l/takomi?color=%234c1)](https://github.com/JStaRFilms/VibeCode-Protocol-Suite/blob/main/LICENSE)
</div>

---

## What Is Takomi?

**AI shouldn't feel like a chatbot. It should feel like a teammate.**

Takomi is a complete workflow system for collaborating with AI to build software. Think of yourself as the CEO, and your AI assistants as a specialized, high-performance development team — an Architect who plans, a Builder who implements, a Reviewer who catches mistakes, and an Orchestrator who coordinates them all.

This isn't prompt engineering. This is **orchestrated development** — a battle-tested collection of protocols, workflows, and skills that transform AI coding assistants into genuine project partners. It works across every major AI-powered IDE and even browser-based AI like ChatGPT and Claude.

---

## Features

- **🧠 72+ Skills** — Specialized capabilities from security audits to AI video generation, installed on demand
- **🔄 Universal IDE Sync** — Install once, sync to Antigravity, Claude Code, Codex, Cursor, Kilo Code, Pi, and Windsurf
- **🏗️ Full Project Lifecycle** — From genesis (planning) through design, build, and finalize — with verification gates at every step
- **🎭 Specialized Agent Modes** — Orchestrator, Architect, Coder, Debugger, Reviewer — each with purpose-built workflows
- **📦 Codex-Native Skills** — Use natural language (`use takomi genesis`) — no slash commands required
- **🔌 Pi Harness Integration** — First-class Pi support with context management, model routing, and optional feature packs
- **🌐 Global Skills Router** — One `~/.takomi/` store, synced to every IDE via symlinks or copy

---

## Quick Start

```bash
npm install -g takomi
takomi setup
```

That's it. Takomi auto-detects your installed IDEs, creates your toolkit at `~/.takomi/`, and syncs your selected skills everywhere.

```bash
# Day-to-day usage
takomi              # Launch in your current project
takomi status       # See what's connected
takomi refresh      # One-command update for everything
takomi doctor       # Run diagnostics
```

<details>
<summary><strong>📋 More install options (Pi, Codex, per-project, browser)</strong></summary>

### Pi Harness

```bash
takomi setup pi
cd my-project
takomi
```

Optional global skills and feature packs:

```bash
takomi setup skills        # Core Skills on first install, custom category browser on repeat
takomi setup pi-features   # Optional Pi packages (Interview, Todo, Browser QA, Doc Preview)
```

### Codex Plugin Marketplace

Add the Takomi marketplace to Codex and browse plugins directly from the Codex UI:

**Add the marketplace source** — In Codex, go to **Plugins → Add plugin marketplace** and enter:

| Field | Value |
|-------|-------|
| **Source** | `JStaRFilms/VibeCode-Protocol-Suite` |
| **Git ref** | `main` |
| **Sparse paths** | `.agents/plugins`<br>`plugins` |

> **Tip:** For the full J StaR plugin catalog, use `.agents/plugins` and `plugins` as sparse paths instead.

Once added, search for "TakomiFlow" or "takomi-codex" inside the Codex plugin browser and install.

You can also use Takomi skills with natural language — no slash commands needed:

```text
use takomi
use takomi genesis
continue build with takomi
```

See [Takomi Codex Onboarding](docs/takomi-codex-onboarding.md) for activation, policy loading, roadbooks, and troubleshooting.

### Per-Project Setup

Drop workflows into a single project without global install:

```bash
npx takomi init
```

Choose from `.agent` folder (Cursor, Windsurf, Gemini Code Assist), Agent YAMLs (Kilo Code), or legacy protocols (browser AI).

### Global Install (Multi-IDE)

Install once. Use everywhere. Skills follow you across all detected AI harnesses:

```bash
npx takomi install
```

### Browser-Based AI (ChatGPT, Claude.ai, Gemini)

1. Open a `.md` file from `Legacy (Manual Method)/`
2. Copy the entire prompt
3. Paste into your AI chat
4. Follow the conversation flow

| # | Protocol | Purpose |
|---|----------|---------|
| 1 | **Project Genesis Protocol** | Start any new project |
| 2 | **Ultimate Orchestration Prompt** | One-shot prompt for quick scripts |
| 3 | **Design System Genesis Protocol** | Create visual design systems |
| 5 | **Escalation & Handoff Protocol** | When AI gets stuck |
| 9 | **Reverse Genesis Protocol** | Onboard AI to existing codebases |

</details>

<details>
<summary><strong>🔌 TakomiFlow (Google Flow Assets)</strong></summary>

TakomiFlow packages Google Flow image/video generation as a Codex plugin with MCP tools plus a CLI fallback. It can generate Flow keyframes, short video shots, moodboards, collect downloaded assets, extract review frames, and record Flow project URLs.

```powershell
.\scripts\install-takomi-flow.ps1 -InstallDependencies
```

See [TakomiFlow Onboarding](docs/takomi-flow-onboarding.md) and [TakomiFlow Public Distribution](docs/takomi-flow-public-distribution.md).

</details>

---

## Skill Ecosystem

Think of skills as specialized team members you can summon on demand. Takomi ships **72+ skills** organized by category.

### Core Skills (Default Install)

```
takomi                 ai-sdk                 sync-docs
code-review            security-audit         optimize-agent-context
agent-recovery         avoid-feature-creep    git-commit-generation
```

### Install More Skills

```bash
# Interactive browser — pick what you need
takomi setup skills

# Or via the external skills CLI
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite
```

<details>
<summary><strong>📚 Full skill categories</strong></summary>

**Convex Development Suite** — `convex`, `convex-agents`, `convex-best-practices`, `convex-functions`, `convex-schema-validator`, `convex-realtime`, `convex-file-storage`, `convex-migrations`, `convex-http-actions`, `convex-cron-jobs`, `convex-component-authoring`, `convex-security-audit`, `convex-security-check`

**AI Media Suite** — `ai-avatar-video`, `ai-marketing-videos`, `ai-podcast-creation`, `ai-product-photography`, `ai-social-media-content`, `ai-voice-cloning`

**Frontend & Design** — `frontend-design`, `ui-ux-pro-max`, `21st-dev-components`, `stitch`, `web-design-guidelines`, `building-native-ui`, `component-analysis`

**SEO & Marketing** — `seo-ready`, `programmatic-seo`, `audit-website`, `copywriting`, `marketing-ideas`, `pricing-strategy`, `social-content`, `google-trends`

**Documentation & Office** — `pdf`, `docx`, `pptx`, `xlsx`, `crafting-effective-readmes`, `sync-docs`

**Dev Tooling** — `nextjs-standards`, `remotion`, `monorepo-management`, `git-worktree`, `github-ops`, `webapp-testing`, `upgrading-expo`, `jules`

**Branding & Naming** — `global-brand-namer`, `domain-name-brainstormer`

**Content & Automation** — `youtube-pipeline`, `twitter-automation`, `prompt-engineering`, `algorithmic-art`

</details>

---

## Workflows & Modes

### Project Lifecycle

| Command | What It Does |
|---------|--------------|
| `/vibe-genesis` | Architect a new project — PRD, issues, guidelines |
| `/vibe-design` | Generate design system and page mockups |
| `/vibe-build` | Scaffold and build with verification gates |
| `/vibe-continueBuild` | Resume work in a new chat session |
| `/vibe-finalize` | Final verification and handoff report |
| `/reverse_genesis` | Onboard AI to an existing codebase |

### Specialized Modes

| Command | Role | When to Use |
|---------|------|-------------|
| `/mode-orchestrator` | Coordinator | Complex multi-agent projects |
| `/mode-architect` | Planner | System design before coding |
| `/mode-code` | Implementer | Day-to-day coding |
| `/mode-debug` | Diagnostician | Hard-to-find bugs |
| `/mode-ask` | Analyst | Explain without changing code |
| `/mode-review` | Reviewer | Pre-commit quality gates |

### Daily Commands

| Command | What It Does |
|---------|--------------|
| `/vibe-primeAgent` | Load project context at session start |
| `/vibe-spawnTask` | Break down complex features into tasks |
| `/vibe-syncDocs` | Update docs after code changes |
| `/escalate` | Generate escalation report when stuck |
| `/migrate` | Transfer context to a new session |

---

## Supported IDEs

Install once into `~/.takomi/` — Takomi syncs skills to each harness automatically.

| Harness | Skills Path | Workflows Path |
|---------|-------------|----------------|
| **Antigravity** | `~/.gemini/config/skills/` | `~/.gemini/config/global_workflows/` |
| **Claude Code** | `~/.claude/skills/` | — |
| **Codex** | `~/.codex/skills/` | — |
| **Cursor** | `~/.cursor/skills/` | — |
| **Kilo Code** | `~/.kilocode/skills/` | `~/.kilocode/workflows/` |
| **Pi / Agent Skills** | `~/.agents/skills/` | — |
| **Windsurf** | `~/.codeium/windsurf/skills/` | `~/.codeium/windsurf/global_workflows/` |

<details>
<summary><strong>🔧 CLI reference</strong></summary>

| Command | What It Does |
|---------|--------------|
| `takomi` | Launch in the current project |
| `takomi setup` | Guided first-time setup |
| `takomi setup pi\|skills\|project\|all` | Targeted setup |
| `takomi refresh` | One-command update (CLI + Pi + skills) |
| `takomi refresh pi\|skills\|project\|all` | Targeted refresh |
| `takomi add <url>` | Pull skills from any GitHub repo |
| `takomi status` | See connections and toolkit status |
| `takomi doctor` | Run diagnostics |

Legacy aliases: `install` → `setup`, `sync`/`upgrade` → `refresh`, `init` → `setup project`.

</details>

<details>
<summary><strong>🧩 Context Manager (Pi)</strong></summary>

Takomi ships a Pi-native `takomi-context-manager` extension that reduces prompt bloat with progressive context loading:

- Skill names are always visible; descriptions and full `SKILL.md` files load only when needed
- Tools: `skill_manifest`, `skill_load`, `policy_manifest`, `policy_load`, `context_report`
- `/takomi routing` is the source of truth for model-routing policy
- `/context-report` shows prompt compaction, loaded skills/policies, blocked actions, and diagnostics
- Supports `mode: "summary" | "verbose" | "problems"`

</details>

---

## Repository Structure

| Folder | Purpose | Who It's For |
|--------|---------|--------------|
| **`.agent/`** | Workflows & Skills for agentic IDEs | Cursor, Windsurf, Gemini Code Assist |
| **`Legacy (Manual Method)/`** | Copy-paste prompts & protocols | Browser AI users |
| **`Deep_Source_Prompts/`** | Reference docs & source materials | Contributors, prompt engineers |

---

## Philosophy

- **Structured Collaboration** — Clear roles for each AI agent, not free-form chatting
- **Documentation-Driven** — Every project gets proper docs, issues, and roadmaps
- **Verification Gates** — `tsc --noEmit` after every edit, 1:1 feature-to-issue mapping
- **Scalable** — Works for tiny scripts or enterprise applications
- **Own Your Stack** — No vendor lock-in, works across every major IDE

---

## Contributing

This is a living system. If you discover improvements:

1. Test your changes with real projects
2. Add reference materials to `Deep_Source_Prompts/` if needed
3. Create workflows in `.agent/workflows/` for agentic IDEs
4. Update legacy prompts in `Legacy (Manual Method)/` for browser users
5. Open a [GitHub Issue](https://github.com/JStaRFilms/VibeCode-Protocol-Suite/issues) with your proposed changes

---

<details>
<summary><strong>🙏 Acknowledgements</strong></summary>

Takomi-original skills, workflows, and runtime extensions — including `21st-dev-components` — are authored and maintained by **J StaR Films Studios**.

| Source | Skills / Packages |
|--------|-------------------|
| **[Pi](https://github.com/earendil-works/pi)** by Mario Zechner / Earendil Works | MIT-licensed coding-agent runtime powering the Pi-native Takomi harness |
| **[Anthropic Skills](https://github.com/anthropics/skills)** | Office Suite (PDF/DOCX/PPTX/XLSX), Frontend Design, Webapp Testing, Algorithmic Art, Monorepo Management, Skill Creator |
| **[Inference.sh](https://github.com/inference-sh/skills)** | Marketing Videos, Voice Cloning, Social Content, Twitter Automation, Product Photography, Prompt Engineering |
| **[Marketing Skills](https://github.com/coreyhaines31/marketingskills)** | Copywriting, Pricing Strategy, Social Strategy, Programmatic SEO, Marketing Ideas |
| **[Expo](https://github.com/expo/skills)** | Building Native UI, Upgrading Expo |
| **[Vercel AI SDK](https://github.com/vercel/ai)** | AI SDK reference, Web Design Guidelines |
| **[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)** | Premium design intelligence |
| **[Remotion](https://github.com/remotion-dev/skills)** | Programmatic video creation |
| **[Subagent Development](https://github.com/obra/superpowers)** | Advanced implementation planning |
| **[Context7](https://github.com/upstash/context7)** | Library documentation fetcher |
| **[Audit Website](https://github.com/squirrelscan/skills)** | Professional website auditor |
| **[Convex Skills](https://github.com/waynesutton/convexskills)** | Full Convex suite (Functions, Schema, Realtime, Agents, File Storage, Migrations, HTTP Actions, Cron, Components, Security) |
| **[Google Stitch](https://github.com/google-labs-code/stitch-skills)** | Design-to-code suite (design-md, enhance-prompt, stitch-loop, react-components, shadcn-ui) |
| **[Jules](https://github.com/sanjay3290/ai-skills)** | Google Jules AI agent delegation |
| **[pi-subagents](https://github.com/nicobailon/pi-subagents)** by Nico Bailon | Pi extension for delegated subagent runs |
| **[rpiv-ask-user-question](https://github.com/juicesharp/rpiv-mono)** by juicesharp | Structured user questions (optional Pi pack) |
| **[rpiv-todo](https://github.com/juicesharp/rpiv-mono)** by juicesharp | Live todo overlays (optional Pi pack) |
| **[pi-chrome](https://github.com/tianrendong/pi-chrome)** by tianrendong | Browser automation (optional Pi pack) |
| **[pi-markdown-preview](https://github.com/omaclaren/pi-markdown-preview)** by omaclaren | Markdown/LaTeX previews (optional Pi pack) |
| **[context-mode](https://github.com/mksglu/context-mode)** by Mert Koseoğlu | External context-window project (not bundled) |
| **[kilocode](https://github.com/Kilo-Org/kilocode)** by Kilo-Org | Git commit generation |
| **[pr-comment-fix](https://gist.github.com/GSonofNun/35c67304c35dac7d6b43308b5371f671)** | PR review comment automation |

</details>

## License

Takomi is licensed under the [ISC License](LICENSE). Feel free to use, modify, and share. The goal is to improve AI-human collaboration for everyone.

---

<div align="center">
  <p><strong>Built with ❤️ by artisans who code with the flow</strong></p>
  <p><em>Transform AI from a tool into a true development partner</em></p>
</div>
