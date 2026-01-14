---
name: prime-agent
description: Load project context including coding guidelines, styling rules, and folder structure before starting work.
---

# Prime Agent Skill

Load the "brain" of the project — coding guidelines, styling rules, and architectural decisions.

## When to Use
- Start of session
- Before complex work
- After `/migrate` to supplement snapshot
- When context seems lost

## Load Core Documentation

```bash
# Coding Guidelines
cat docs/coding_guidelines.md 2>/dev/null || \
cat docs/Coding_Guidelines.md 2>/dev/null

# Styling Guide
cat docs/Styling*.md 2>/dev/null || \
cat docs/design/*.md 2>/dev/null

# Styling Addendum (project-specific)
cat docs/Styling-Addendum.md 2>/dev/null
```

## Check for UI Mockups

```bash
ls docs/mockups/ 2>/dev/null
ls docs/design/mockups/ 2>/dev/null
ls docs/design/design-system.html 2>/dev/null
```

> **IMPORTANT**: If mockups exist, they are the **UNQUESTIONABLE source of truth** for UI. Replicate exactly.

## Key Rules to Internalize

### From Coding Guidelines
- **Blueprint Protocol**: Plan before code, docs in `docs/features/`
- **200-Line Rule**: Refactor if exceeded
- **File Structure**: Feature-sliced design (`src/features/[Name]/`)
- **Server vs Client**: RSCs by default, `'use client'` sparingly
- **Service Pattern**: Route Handlers = controllers, Services = business logic
- **Validation**: Zod for all inputs

### From Styling Guide
- **Tailwind v4**: CSS-first with `@theme` tokens
- **Core Tokens**: `--color-background`, `--color-foreground`, `--color-border`
- **Dark Mode**: `@theme .dark { }` overrides
- **Animations**: Define in CSS with `@keyframes`

## Acknowledgment

After loading, state:

"✅ **Agent Primed.** Internalized:

**Coding Guidelines:**
- Blueprint Protocol: Plan → Approve → Build → Document
- 200-line component limit
- Feature-sliced architecture
- Server Components default

**Styling Rules:**
- Tailwind v4 with `@theme` tokens
- Dark mode via `.dark` class

**UI Mockups:** [List any found or 'None']

What would you like to build?"

## Quick Reference Card

```
src/
├── app/           # Next.js App Router pages
├── features/      # Feature-sliced modules
│   └── [Name]/    # Components, hooks, services
├── components/ui/ # Reusable UI components
├── lib/           # Utilities, API clients
└── scripts/       # Build/automation scripts
```

**Key Commands:**
- `npm run dev` — Start development
- `npm run build` — Production build
- `npm run db:seed` — Seed database

**Style Tokens:**
- `bg-background` / `text-foreground`
- `bg-primary` / `text-primary`
- `dark:` prefix for dark mode
