# 21st.dev Components Skill

## Overview
`21st-dev-components` is an original Takomi skill for turning 21st.dev discoveries into real React integrations. It supports both automatic reference-site matching and a manual handoff flow, so users can either let the agent choose components or collect them themselves and hand them back for integration.

## Architecture
- **Skill File:** `assets/.agent/skills/21st-dev-components/SKILL.md`
- **Primary Use Case:** React-family projects that want ready-made UI building blocks from 21st.dev
- **Bundled Resources:** category map, manual handoff template, section-detection rubric, and source-fetching scripts

## Key Components

### Auto Mode
The skill can inspect a live reference site, break it into sections, map those sections to 21st.dev categories, resolve candidate component pages, fetch source from the CDN, and integrate the selected components into the current repo.

### Manual Mode
The skill can also generate a collection checklist for the user, accept a combined handoff containing URLs, copied prompts, dependency notes, and code, then adapt the returned pieces to the current project structure.

### Bundled Scripts
- `scripts/resolve-21st-component.mjs` normalizes component metadata from a 21st.dev page
- `scripts/fetch-21st-source.mjs` downloads CDN-hosted source files for integration
- `scripts/build-manual-handoff-template.mjs` generates a reusable markdown handoff file

## Integration Rules
- v1 is React-only
- existing repo structure should be preserved whenever possible
- dependencies, utility helpers, and styling assumptions must be adapted to the target repo instead of forcing a new structure
- if Auto mode is blocked, the workflow should fall back to Manual mode instead of stalling

## Ownership
This skill is a Takomi-original workflow authored in-house for this repository. It integrates with 21st.dev resources, but the workflow itself is part of the Takomi/IP bundle maintained by J StaR Films Studios.
