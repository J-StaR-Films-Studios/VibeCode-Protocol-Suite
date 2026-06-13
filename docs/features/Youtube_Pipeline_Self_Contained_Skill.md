# YouTube Pipeline Self-Contained Skill

## Goal

Make `assets/.agent/skills/youtube-pipeline` portable across agent harnesses by bundling the workflow, knowledge, prompts, and helper scripts it needs inside the skill folder. Agents should not need the user's Obsidian vault, a Gemini-specific install path, or any one AI harness to run the pipeline.

## Components

### Skill Entry

- `assets/.agent/skills/youtube-pipeline/SKILL.md`
  - Defines the workflow map, resource-loading order, optional integrations, and update process.

### Workflow Resources

- `assets/.agent/skills/youtube-pipeline/resources/youtube-pipeline.md`
- `assets/.agent/skills/youtube-pipeline/resources/youtube-phase1-strategy.md`
- `assets/.agent/skills/youtube-pipeline/resources/youtube-phase2-packaging.md`
- `assets/.agent/skills/youtube-pipeline/resources/youtube-phase3-scripting.md`
- `assets/.agent/skills/youtube-pipeline/resources/youtube-phase3.5-shorts.md`
- `assets/.agent/skills/youtube-pipeline/resources/youtube-phase4-production.md`
- `assets/.agent/skills/youtube-pipeline/resources/youtube-phase5-repurposing.md`

### Bundled Knowledge And Prompts

- `assets/.agent/skills/youtube-pipeline/resources/knowledge/`
- `assets/.agent/skills/youtube-pipeline/resources/prompts/`

### Helper Scripts

- `assets/.agent/skills/youtube-pipeline/scripts/parse_yt_studio.ps1`
- `assets/.agent/skills/youtube-pipeline/scripts/google-trends/search.js`
- `assets/.agent/skills/youtube-pipeline/scripts/google-trends/package.json`
- `assets/.agent/skills/youtube-pipeline/scripts/google-trends/pnpm-lock.yaml`

## Data Flow

1. The agent loads `SKILL.md`.
2. The agent resolves `<skill-root>` as the folder containing `SKILL.md`.
3. The agent reads workflow files from `<skill-root>/resources/`.
4. Phase workflows load supporting knowledge from `<skill-root>/resources/knowledge/`.
5. Prompt templates are available from `<skill-root>/resources/prompts/`.
6. The YouTube Studio parser runs from `<skill-root>/scripts/` when the user provides an exported HTML file.
7. The bundled Google Trends CLI runs from `<skill-root>/scripts/google-trends/` for automated trend checks.
8. If Node dependencies are unavailable, agents fall back to the manual Google Trends workflow.

## Database Schema

No database is involved. The skill is file-based and does not add persistent application state.

## Regression Checks

- No hardcoded `C:\CreativeOS\...` paths inside the skill.
- No `$env:USERPROFILE\.gemini\...` command examples.
- No instruction that requires the user's vault for normal operation.
- The Google Trends CLI is bundled locally and documented with skill-root-relative commands.
- Resource paths remain relative to the skill root so the package can be installed by any compatible harness.
