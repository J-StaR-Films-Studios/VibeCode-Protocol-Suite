---
description: Define the UI and UX for a Takomi project, with standard design artifacts and a clear Build handoff
---
# Workflow: Vibe Design

Design is for UI and UX. Genesis owns product requirements, application architecture, data models, API contracts, and implementation strategy. If the work has no UI, recommend Build without inventing mockups. If a design is already approved, update only what the requested change affects.

## 1. Read the foundation

Read `docs/Project_Requirements.md`, the relevant `docs/issues/FR-XXX.md` files, and `docs/Builder_Prompt.md` when present. Inspect existing screens, design assets, and mockups before proposing a new direction. Resolve any decision that changes the user journey with the user; make routine visual decisions from the brief.

## 2. Define the experience

Map the user journey, screen inventory, interaction states, responsive behavior, and accessibility needs. Establish the visual direction: branding, color, type, imagery, and motion where relevant. Reuse an established design system unless the user requests a change.

## 3. Author the standard design artifacts

Use these paths by default. An explicit user instruction or an established, incompatible project layout can override them; preserve existing work and state the mapping.

- `docs/design/sitemap.md`: pages or screens, their purpose, and key components. For a full project, cover every planned user-facing page; for a feature, cover the affected screens.
- `docs/design/design-system.html`: a portable visual reference for shared tokens, typography, components, states, layout, and responsive behavior. Update the existing file if one is already present.
- `docs/mockups/<screen>.html`: a mockup for each screen in the approved sitemap or feature scope, including important interaction states. Keep mockups responsive and consistent with the design system.
- `docs/Builder_Prompt.md`: add the mockup paths, interaction rules, and accessibility constraints Build must follow.

Choose prototype tools and styling to fit the project. Tailwind CDN, a specific icon library, and a fixed color palette are not universal requirements. Mockups are the UI reference, but explicit requirements and accessibility take priority over copying a mistake.

## 4. Handoff

List the files created or updated, the FRs and screens covered, unresolved decisions, and the next Build task. Leave application architecture and backend implementation to Genesis and Build.
