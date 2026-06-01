# Orchestrator Master Plan

## Overview
- Session id: `orch-20260601-222051`
- Product/project: Takomi
- Mission: Make Takomi Stats a first-class bundled Takomi capability, available both as a Pi slash command and a standalone `takomi stats` CLI command.
- Current phase: Build handoff completed for the first integrated MVP.

## Context Intake
- Source of truth: user requested a terminal-native profile/stats dashboard inspired by the supplied screenshot.
- Existing precedent: `C:/Users/johno/token-usage-dashboard` already proves Pi/Codex log scanning and pricing aggregation.
- Takomi integration constraint: this is not a secondary dashboard; it must ship inside Takomi and be reachable from both Pi/Takomi slash commands and direct CLI use.
- Privacy constraint: summarize metadata only; do not print raw prompts/transcripts.

## Skills Registry
- Takomi orchestration: used to keep the feature aligned with Genesis → Design → Build lifecycle.
- No optional external skill was required for the MVP.

## Workflows Registry
- Genesis: scoped stats sources, privacy stance, and integration points.
- Build: implemented bundled scanner/renderer and command registrations.
- Review: verified CLI output and TypeScript compile health.

## Task Table
| # | Subtask | Mode/Role | Workflow | Overlays | Dependency | Status |
|---|---|---|---|---|---|---|
| 01 | Implement first-class Takomi Stats | orchestrator/code | vibe-build | Takomi runtime context | User approval | completed |

## Progress Checklist
- [x] Inspect current Takomi CLI and Pi runtime command surfaces.
- [x] Inspect real `~/.pi` harness data and existing token dashboard scanner.
- [x] Add standalone `takomi stats` command.
- [x] Add `/takomi stats` and `/takomi-stats` slash commands.
- [x] Keep raw transcript content private by default.
- [x] Verify CLI execution.
- [x] Verify TypeScript compile.

## Notes
- `src/takomi-stats.js` is intentionally reusable by both CLI and Pi runtime.
- Current stats are based on explicit Pi usage metadata plus `run-history.jsonl` agent run metadata.
- Cost is an estimate and depends on locally maintained pricing rows.
