# Builder Prompt: takomi-context-manager

You are building `takomi-context-manager`, a Pi extension that reduces Pi/Takomi prompt bloat through progressive context loading.

## Source Documents

Read first:

- `docs/features/Takomi_Context_Manager.md`
- `docs/context-manager/Context_Source_Audit.md`
- `docs/Project_Requirements.md`
- `docs/context-manager/Verification_Strategy.md`
- `docs/features/Takomi_Orchestration_Task_Quality.md`

## Implementation Priority

1. Create project-local extension scaffold at `.pi/extensions/takomi-context-manager/index.ts`.
2. Register progressive skill tools:
   - `skill_index`
   - `skill_manifest`
   - `skill_load`
   - `context_report`
3. Use Pi extension hooks to inspect prompt options and build diagnostics.
4. Replace or compact always-on skill descriptions into a names-only Skill Index where extension hooks allow.
5. Add candidate context surfacing from skill metadata.
6. Move heavy policy/workflow context into explicit packs where possible.
7. Add duplicate extension conflict detection/reporting if feasible.

## Hard Rules

- Do not make the Tool Contract mediocre. Keep read/bash/edit/write guidance precise.
- Do not load full skill instructions unless the skill is actually used.
- Manifest step is optional. If the user names a skill directly, full skill load may happen directly.
- Keep Takomi runtime gates compact.
- Do not force orchestration for small tasks.

## Testing

Primary:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1
```

Alternative:

```powershell
cd ..
pi
```

## Known Issue to Investigate

Subagent dispatch currently hit duplicate extension conflicts:

- global `takomi-runtime` vs project `.pi/extensions/takomi-runtime`
- global `takomi-subagents` vs project `.pi/extensions/takomi-subagents`

This is not necessarily part of the MVP implementation, but it must be documented and ideally surfaced by diagnostics.

## Definition of Done

- The extension loads in Pi without breaking existing Takomi tools.
- Skill index returns names only.
- Manifest tool returns descriptions and locations for multiple skills.
- Skill load returns full `SKILL.md` for one chosen skill.
- Context report explains prompt composition.
- Verification cases in `docs/context-manager/Verification_Strategy.md` are runnable.
