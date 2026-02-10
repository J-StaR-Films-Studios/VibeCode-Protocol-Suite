---
description: Google Stitch design-to-code workflow. Routes to the correct sub-skill based on what the user needs.
---

# /stitch — Google Stitch Design Platform

## Overview
This workflow routes you to the correct Stitch sub-skill. All skills live in `~/.gemini/antigravity/skills/stitch/`.

## Step 1: Read the Master Skill
// turbo
Read the master SKILL.md to understand what's available:
```
view_file ~/.gemini/antigravity/skills/stitch/SKILL.md
```

## Step 2: Identify What the User Needs

Match the user's request to a sub-skill:

| User wants... | Sub-skill | Read this |
|---|---|---|
| Extract/document a design system | `design-md` | `stitch/design-md/SKILL.md` |
| Improve a UI prompt before generation | `enhance-prompt` | `stitch/enhance-prompt/SKILL.md` |
| Build a multi-page site iteratively | `stitch-loop` | `stitch/stitch-loop/SKILL.md` |
| Convert Stitch HTML → React components | `react-components` | `stitch/react-components/SKILL.md` |
| Create a walkthrough video of screens | `remotion` | `stitch/remotion/SKILL.md` |
| Work with shadcn/ui components | `shadcn-ui` | `stitch/shadcn-ui/SKILL.md` |

## Step 3: Load the Sub-Skill
// turbo
Read the specific sub-skill's `SKILL.md`:
```
view_file ~/.gemini/antigravity/skills/stitch/{sub-skill}/SKILL.md
```

## Step 4: Check for Supporting Resources

Each sub-skill may have `resources/`, `examples/`, and `scripts/` folders. Check them for:
- **resources/**: Checklists, style guides, reference docs
- **examples/**: Gold-standard reference implementations
- **scripts/**: Validation and networking helpers

```
ls ~/.gemini/antigravity/skills/stitch/{sub-skill}/
```

## Step 5: Execute

Follow the sub-skill's instructions step by step. Key reminders:

1. **Stitch MCP Required**: Most skills need the Stitch MCP server connected. Check with `list_tools` for `stitch:` prefix.
2. **DESIGN.md First**: If building multiple pages, always generate `DESIGN.md` first using `design-md`.
3. **shadcn-ui is standalone**: It works without the Stitch MCP — just needs the shadcn CLI or MCP.
4. **Chain skills**: For full site builds, follow the chain: `design-md` → `enhance-prompt` → `stitch-loop` → `react-components`.

## Prerequisites

- **Stitch MCP Server** — Required for `design-md`, `enhance-prompt`, `stitch-loop`, `react-components`, `remotion`
- **shadcn MCP Server or CLI** — Required for `shadcn-ui`
- **Remotion** — Required for the `remotion` sub-skill
- **Node.js + npm** — Required for `react-components` validation scripts
