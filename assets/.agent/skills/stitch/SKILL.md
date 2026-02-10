---
name: stitch
description: |
  Google Stitch design platform skill bundle. Covers design system extraction,
  prompt enhancement, iterative site building, React component conversion,
  Remotion walkthrough videos, and shadcn/ui component integration.
  Activate when user mentions Stitch, design-to-code, DESIGN.md, shadcn/ui,
  or iterative site generation.
---

# Google Stitch — Skill Bundle

This folder contains 6 sub-skills for working with [Google Stitch](https://stitch.withgoogle.com/), a design-to-code platform with an MCP server. Each sub-skill has its own `SKILL.md` with full instructions.

## Prerequisites

Most skills require the **Stitch MCP Server** to be connected. The `shadcn-ui` skill works independently with the shadcn MCP server or CLI.

## Sub-Skill Directory

Read the linked `SKILL.md` for any sub-skill before using it.

### 1. `design-md` — Design System Extraction
[→ Read SKILL.md](design-md/SKILL.md)

**What:** Analyzes Stitch project screens and generates a semantic `DESIGN.md` file documenting the visual design system (colors, typography, depth, layout, component styles).

**When to use:**
- Starting a new multi-page project and need a design system reference
- Onboarding to an existing Stitch project
- Need consistent design language across agent-generated screens

**Outputs:** `DESIGN.md` file

---

### 2. `enhance-prompt` — Prompt Enhancement
[→ Read SKILL.md](enhance-prompt/SKILL.md)

**What:** Transforms vague UI ideas into polished, structured prompts optimized for Stitch generation. Adds UI/UX keywords, design system context, and page structure.

**When to use:**
- User gives a vague prompt like "make me a login page"
- Previous Stitch generation produced poor results
- Need to inject `DESIGN.md` tokens into a prompt

**Outputs:** Enhanced prompt text or `next-prompt.md` file

---

### 3. `stitch-loop` — Iterative Build Loop
[→ Read SKILL.md](stitch-loop/SKILL.md)

**What:** Autonomous baton-passing loop for building multi-page websites. Each iteration reads a task (`next-prompt.md`), generates a page, integrates it, updates docs, and writes the next task.

**When to use:**
- Building a complete multi-page site from scratch
- Need autonomous, continuous page generation
- Want a structured sitemap-driven build process

**Depends on:** `design-md` (for `DESIGN.md`), `enhance-prompt` (for baton prompts)
**Outputs:** Full site in `site/public/`, updated `SITE.md`

---

### 4. `react-components` — Design to React
[→ Read SKILL.md](react-components/SKILL.md)

**What:** Converts Stitch-generated HTML into modular React/TypeScript components with proper props interfaces, mock data layers, and AST-based validation.

**When to use:**
- Converting a Stitch screen into production React code
- Need type-safe, modular component extraction from HTML
- Want automated validation of component architecture

**Outputs:** React components in `src/`, mock data in `src/data/mockData.ts`

---

### 5. `remotion` — Walkthrough Videos
[→ Read SKILL.md](remotion/SKILL.md)

**What:** Generates walkthrough videos from Stitch project screenshots using Remotion, with smooth transitions, zoom effects, and text overlays.

**When to use:**
- Need a video showcase of designed screens
- Want to create a professional app walkthrough
- Building a demo reel from Stitch designs

> **Note:** For general Remotion work (not Stitch-specific), use the main `remotion` skill instead — it has 25+ rule files from Remotion's official repo.

**Outputs:** Remotion project + rendered `.mp4`

---

### 6. `shadcn-ui` — Component Library
[→ Read SKILL.md](shadcn-ui/SKILL.md)

**What:** Expert guidance for integrating shadcn/ui components — discovery, installation, customization, variants, blocks, and accessibility. Works with the shadcn MCP server or CLI.

**When to use:**
- Setting up shadcn/ui in a new project
- Installing or customizing shadcn components
- Building forms, data tables, auth layouts, or dashboards
- Need component variant patterns with `cva`

> **Note:** This skill works independently of Stitch. It's useful for any React/Next.js project.

**Outputs:** Installed components in `components/ui/`, configured `components.json`

---

## Skill Chains

These skills are designed to work together in sequence:

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  design-md  │ ──→ │ enhance-prompt  │ ──→ │ stitch-loop  │
│ (extract    │     │ (polish the     │     │ (build pages │
│  design     │     │  prompt with    │     │  iteratively │
│  system)    │     │  design tokens) │     │  using baton)│
└─────────────┘     └─────────────────┘     └──────────────┘
                                                    │
                                              ┌─────┴──────┐
                                              ▼            ▼
                                    ┌──────────────┐ ┌──────────┐
                                    │   react-     │ │ remotion │
                                    │ components   │ │ (video)  │
                                    │ (production  │ └──────────┘
                                    │  React code) │
                                    └──────────────┘
```

### Typical Workflow
1. **`design-md`** → Analyze an existing screen → get `DESIGN.md`
2. **`enhance-prompt`** → Write a prompt for the next page → inject design tokens
3. **`stitch-loop`** → Generate page → integrate → write next baton → repeat
4. **`react-components`** → Convert final HTML pages to production React
5. **`remotion`** → Create a walkthrough video of the finished product

### Standalone Usage
- **`shadcn-ui`** — Use anytime for React/Next.js UI component work
- **`design-md`** — Use standalone to document any project's design system
- **`enhance-prompt`** — Use standalone to improve any UI generation prompt

## Acknowledgements

- Based on [stitch-skills](https://github.com/google-labs-code/stitch-skills)
- This is not an officially supported Google product. This project is not eligible for the [Google Open Source Software Vulnerability Rewards Program](https://bughunters.google.com/open-source-security).
