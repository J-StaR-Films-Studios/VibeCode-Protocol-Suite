---
description: Google Stitch design-to-code workflow. Routes to the correct sub-skill based on what the user needs.
---

# /stitch — Google Stitch Design Platform

## Overview
This workflow orchestrates the full Stitch design-to-code pipeline. All skills live in `.agent/skills/stitch/`.

**The Stitch bundle is NOT a pick-one-and-go system.** It's a **pipeline** of 6 skills that chain together. Your job is to guide the user through the journey, always suggesting the next logical step.

## Step 1: Read the Master Skill
// turbo
Read the master SKILL.md — it contains the **Pipeline Orchestration Protocol** which you MUST follow:
```
view_file .agent/skills/stitch/SKILL.md
```

## Step 2: Identify the Entry Point

Use the decision tree from the master SKILL.md to determine WHERE the user enters the pipeline:

| User says... | Start at | Pipeline position |
|---|---|---|
| "Build me a site with Stitch" | `design-md` | Step 1 → full pipeline |
| "I have a Stitch project, make it consistent" | `design-md` | Step 1 → Steps 2-3 |
| "Generate a page with Stitch" | `enhance-prompt` | Step 2 → Step 3 |
| "I have Stitch HTML, make it React" | `react-components` | Step 4 → shadcn-ui |
| "Make a video of my Stitch screens" | `remotion` | Step 5 (standalone) |
| "I need UI components for my React app" | `shadcn-ui` | Companion (standalone) |
| "Improve my Stitch prompt" | `enhance-prompt` | Step 2 → Step 3 |
| "I already have DESIGN.md, build pages" | `stitch-loop` | Step 3 → Steps 4-5 |

## Step 3: Load the Entry Sub-Skill
// turbo
Read the specific sub-skill's `SKILL.md`:
```
view_file .agent/skills/stitch/{sub-skill}/SKILL.md
```

## Step 4: Check for Supporting Resources

Each sub-skill may have `resources/`, `examples/`, and `scripts/` folders:
- **resources/**: Checklists, style guides, reference docs
- **examples/**: Gold-standard reference implementations
- **scripts/**: Validation and networking helpers

```
ls .agent/skills/stitch/{sub-skill}/
```

## Step 5: Execute the Sub-Skill

Follow the sub-skill's instructions step by step. Key reminders:

1. **Stitch MCP Required**: Most skills need the Stitch MCP server connected.
2. **DESIGN.md First**: If building multiple pages, always generate `DESIGN.md` first using `design-md`.
3. **shadcn-ui is standalone**: It works without the Stitch MCP — just needs the shadcn CLI or MCP.

## Step 6: Suggest the Next Step (CRITICAL — DO NOT SKIP)

**After completing any sub-skill, you MUST suggest the next step in the pipeline.**

This is the full chain — follow it:

```
design-md (Step 1)
  ↓ suggest → enhance-prompt
enhance-prompt (Step 2)
  ↓ suggest → stitch-loop
stitch-loop (Step 3)
  ↓ suggest → react-components OR remotion
react-components (Step 4)
  ↓ suggest → shadcn-ui AND/OR remotion
remotion (Step 5)
  ↓ pipeline complete
shadcn-ui (Companion)
  ↓ standalone — no automatic next step
```

**How to suggest:**
```
"✅ [Skill Name] is complete. Here's what I accomplished: [summary].

The next step in the pipeline is [Next Skill Name]:
• [What it does]
• [Why it's useful right now]

Would you like to continue with [Next Skill], or is there something else you'd like to do?"
```

**If there are multiple next options (e.g., after stitch-loop):**
```
"✅ stitch-loop is complete. Your site pages are built.

You have two options for the next step:
1. **react-components** — Convert these HTML pages into production-ready 
   React/TypeScript components with proper types and mock data.
2. **remotion** — Create a professional walkthrough video showcasing 
   all the screens you just built.

Which would you like? (You can do both — react-components first, then remotion.)"
```

## Step 7: Loop Back to Step 3

If the user wants to continue to the next skill:
1. Go back to **Step 3** and load the next sub-skill's `SKILL.md`
2. Execute it (Step 5)
3. Suggest the next step (Step 6)
4. Repeat until the pipeline is complete or the user stops

## Pipeline Summary

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  design-md  │ ──→ │ enhance-prompt  │ ──→ │ stitch-loop  │
│ STEP 1      │     │ STEP 2          │     │ STEP 3       │
│ Extract     │     │ Polish prompts  │     │ Build pages  │
│ design      │     │ with design     │     │ iteratively  │
│ system      │     │ tokens          │     │ with batons  │
└─────────────┘     └─────────────────┘     └──────┬───────┘
                                                   │
                                             ┌─────┴──────┐
                                             ▼            ▼
                                   ┌──────────────┐ ┌──────────┐
                                   │   react-     │ │ remotion │
                                   │ components   │ │ STEP 5   │
                                   │ STEP 4       │ │ Video    │
                                   │ Production   │ │ showcase │
                                   │ React code   │ └──────────┘
                                   └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  shadcn-ui   │
                                   │ COMPANION    │
                                   │ Polish with  │
                                   │ component    │
                                   │ library      │
                                   └──────────────┘
```

## Prerequisites

- **Stitch MCP Server** — Required for `design-md`, `enhance-prompt`, `stitch-loop`, `react-components`, `remotion`
- **shadcn MCP Server or CLI** — Required for `shadcn-ui`
- **Remotion** — Required for the `remotion` sub-skill
- **Node.js + npm** — Required for `react-components` validation scripts
