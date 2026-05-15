---
description: Review recent code changes and update docs/features accordingly
---
# Workflow: Documentation Sync

> Direct Takomi workflow prompt for syncing feature documentation after implementation work.

Update `docs/features/` after major code changes so the docs stay aligned with the implementation.

---

## Steps

### 1. Identify Changed Components
Determine the main files or subsystems changed in the recent work.
Use the user request, recent git diff, or known modified files.
Focus on the components that materially affect behavior, architecture, configuration, or usage.

### 2. List Existing Feature Docs
Inspect `docs/features/` and understand current coverage.
Do not create duplicate docs when an update is the correct action.

### 3. Read Existing Docs
Read existing docs that appear related so you can determine scope, naming, and current coverage.

### 4. Determine the Documentation Action
For each changed component, decide whether to:
- **update** an existing feature doc
- **create** a new feature doc
- **skip** if already fully covered and no meaningful doc change is needed

### 5. Documentation Standards
Each feature doc should generally include:
- overview
- architecture
- key components or modules
- optional data flow
- configuration if applicable
- usage notes if relevant
- changelog / hotfix notes when useful

Suggested structure:

```markdown
# Feature Name

## Overview
What this feature does and why it exists.

## Architecture
- **Entry points:** `src/...`
- **Dependencies:** ...

## Key Components
### Component A
...

### Component B
...

## Data Flow
(Optional) Explain how data moves through the system.

## Configuration
(Optional) Document important settings.

## Notes / Recent Changes
- YYYY-MM-DD: ...
```

### 6. Write the Updates
Update or create docs under `docs/features/`.
Ensure file paths mentioned in docs are correct and wrapped in backticks.

### 7. Verify Links and Coverage
Check that:
- mentioned file paths actually exist
- doc names are sensible
- the summary reflects real implementation behavior
- important changes are not omitted

### 8. Summary
Report:
- docs updated
- docs created
- components intentionally skipped
- any areas that still need future documentation

---

## Output Rules
- sync docs to actual implementation, not guesses
- prefer updating the right existing doc over creating duplicates
- keep architecture notes concrete
- mention exact file paths where helpful
