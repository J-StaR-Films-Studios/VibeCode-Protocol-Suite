# Builder Handoff Report: takomi-context-manager

## Built Features

- Project-local Pi extension scaffold at `.pi/extensions/takomi-context-manager/index.ts`.
- Progressive skill loading tools:
  - `skill_index`
  - `skill_manifest`
  - `skill_load`
  - `context_report`
- Skill registry normalization from `systemPromptOptions.skills` with XML fallback.
- Prompt rewrite via `before_agent_start` that replaces verbose `<available_skills>` XML with names-only Skill Index plus progressive loading rules.
- MVP context router candidate scoring and hint injection.
- Diagnostic report state for prompt length, removed sections, candidates, tool calls, loaded skills, and warnings.
- `/context-report` command.
- Local dev script now loads `takomi-context-manager` explicitly.

## Files Created or Changed

- `.pi/extensions/takomi-context-manager/index.ts`
- `scripts/pi-dev.ps1`
- `docs/Project_Requirements.md`
- `docs/Builder_Prompt.md`
- `docs/Builder_Handoff_Report.md`
- `docs/context-manager/Context_Source_Audit.md`
- `docs/context-manager/Verification_Strategy.md`
- `docs/context-manager/Design_Architecture.md`
- `docs/context-manager/Skill_Loading_Design.md`
- `docs/context-manager/Prompt_Rewrite_Design.md`
- `docs/context-manager/Context_Router_Design.md`
- `docs/context-manager/Diagnostics_And_Test_Design.md`
- `docs/context-manager/Build_Task_Breakdown.md`
- `docs/features/Takomi_Context_Manager.md`
- `docs/features/Takomi_Orchestration_Task_Quality.md`
- `docs/issues/FR-001.md` through `docs/issues/FR-012.md`
- `docs/issues/FR-ORCH-QUALITY.md`

## Verification Status

### TypeScript

Command run:

```bash
npx tsc --noEmit
```

Result: **Blocked by existing dependency/package TypeScript errors in `node_modules/.pnpm/pi-subagents...`**.

Targeted check:

```bash
npx tsc --noEmit --pretty false 2>&1 | rg "takomi-context-manager|scripts/pi-dev" || true
```

Result: **No errors reported for the new extension or dev script.**

### Pi Extension Load Smoke Test

Command run:

```bash
powershell -ExecutionPolicy Bypass -File ./scripts/pi-dev.ps1 --help
```

Result: **Passed.** Pi help rendered successfully with explicit local extensions loaded.

## How To Run

Primary local dev path:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1
```

Alternative global Pi path:

```powershell
cd ..
pi
```

## Manual Test Prompts

- `show context_report`
- `list available skills using skill_index`
- `show manifests for takomi and optimize-agent-context`
- `use the takomi skill`
- `this system prompt feels bloated`
- `fix a typo in README`

## Known Issues / Follow-Up

- Full `npx tsc --noEmit` is currently blocked by existing `pi-subagents` type errors unrelated to the new extension.
- Subagent dispatch previously failed when global and project Takomi extensions both registered the same tools. This is documented as `FR-009` future work.
- Candidate scoring is intentionally MVP string matching; semantic/RAG matching is `FR-010` future work.
- Prompt rewriting depends on Pi's current `<available_skills>` XML shape. Diagnostics warn if the block is not found.

## Next Recommended Stage

Run manual Pi testing, then move to Review/Finalize after any fixes found during real interactive use.
